// Soutien scolaire : groupes de soutien, séances, documents, avancement du programme.
// Un groupe de soutien est une ligne de `groups` (kind = 'soutien') : élèves, flashcards et règles d'accès
// fonctionnent comme pour une classe. Les points du programme travaillés en séance sont « publiés » pour le groupe
// (table `publications`, à la date de la séance) : l'élève reçoit leurs flashcards et leurs documents.
import { db, uid, fileBlob, isTutoring, type Group, type Track, type TutoringSession, type Unit, type UnitStatus } from './db';
import { importStudents } from './students';
import { shareTeacherProfile } from './relations';
import { ONLINE } from './supabase';
import { push } from './sync';
import { today } from './dates';
import { browserZone, DEFAULT_ZONE, zonedToUtc } from './time';

export function schoolYear() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

// En ligne, la fonction serveur qui crée les comptes doit déjà connaître le groupe
async function waitPushed(key: string) {
  if (!ONLINE) return;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 300));
    await push();
    if (!(await db.outbox.get(key))) return;
  }
  throw new Error("Le groupe n'a pas pu être enregistré en ligne (vérifiez la connexion).");
}

export async function createTutoring(teacherId: string, students: { firstName: string; lastName: string }[], tracks: Track[]) {
  const name = students.map((s) => `${s.firstName} ${s.lastName.slice(0, 1)}.`.trim()).join(' & ');
  const g: Group = { id: uid(), kind: 'soutien', name, schoolYear: schoolYear(), subject: tracks[0].subject, tracks, teacherIds: [teacherId] };
  await db.groups.put(g);
  await shareTeacherProfile(teacherId);
  await waitPushed(`groups|${g.id}`);
  await importStudents(students, g.id, g.subject);
  return g;
}

export async function addStudents(group: Group, students: { firstName: string; lastName: string }[]) {
  return importStudents(students, group.id, group.subject);
}

export const durationLabel = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
};

// Les points du programme travaillés en séance sont publiés pour le groupe, à la date de la première séance
export async function syncPublications(groupId: string) {
  const sessions = await db.tutoringSessions.where('groupId').equals(groupId).toArray();
  const first = new Map<string, string>();
  for (const s of sessions) for (const u of s.unitIds) if (!first.has(u) || s.date < first.get(u)!) first.set(u, s.date);
  const pubs = await db.publications.where('groupId').equals(groupId).toArray();
  const stale = pubs.filter((p) => first.get(p.unitId) !== p.date).map((p) => p.id);
  if (stale.length) await db.publications.bulkDelete(stale);
  const kept = new Set(pubs.filter((p) => !stale.includes(p.id)).map((p) => p.unitId));
  const add = [...first].filter(([u]) => !kept.has(u)).map(([unitId, date]) => ({ id: uid(), groupId, unitId, date }));
  if (add.length) await db.publications.bulkPut(add);
}

const now = () => {
  const d = new Date();
  const m = Math.round(d.getMinutes() / 15) * 15;
  d.setMinutes(m);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Nouvelle séance : reprend la durée et le lieu de la précédente ; les documents déposés par l'élève
// « pour la prochaine fois » y sont rattachés.
export async function newSession(group: Group): Promise<TutoringSession> {
  const prev = (await db.tutoringSessions.where('groupId').equals(group.id).sortBy('date')).pop();
  const ms = await db.memberships.where('groupId').equals(group.id).toArray();
  const s: TutoringSession = {
    id: uid(),
    groupId: group.id,
    date: today(),
    start: now(),
    tz: browserZone(),
    duration: prev?.duration ?? 60,
    place: prev?.place ?? 'domicile',
    studentIds: ms.map((m) => m.studentId),
    unitIds: [],
    cardIds: [],
    done: '',
    homework: '',
    links: [],
    createdAt: Date.now(),
  };
  await db.tutoringSessions.put(s);
  const waiting = await db.tutoringFiles.where('groupId').equals(group.id).filter((f) => !f.sessionId).toArray();
  for (const f of waiting) await db.tutoringFiles.update(f.id, { sessionId: s.id });
  return s;
}

export async function deleteSession(s: TutoringSession) {
  const notes = await db.sessionNotes.where('sessionId').equals(s.id).toArray();
  const files = await db.tutoringFiles.where('sessionId').equals(s.id).toArray();
  await db.tutoringSessions.delete(s.id);
  await db.sessionNotes.bulkDelete(notes.map((n) => n.id));
  // Les documents ne sont pas perdus : ils redeviennent « pour la prochaine séance »
  for (const f of files) await db.tutoringFiles.update(f.id, { sessionId: undefined });
  // (le travail coché par l'élève reste : il lui appartient, et ne s'affiche plus sans la séance)
  await syncPublications(s.groupId);
  return async () => {
    await db.tutoringSessions.put(s);
    await db.sessionNotes.bulkPut(notes);
    for (const f of files) await db.tutoringFiles.update(f.id, { sessionId: s.id });
    await syncPublications(s.groupId);
  };
}

const MAX_MB = 50;
export async function addFiles(groupId: string, sessionId: string | undefined, files: FileList | File[], authorId: string, byStudent: boolean) {
  let n = 0;
  for (const f of [...files]) {
    if (f.size > MAX_MB * 1048576) {
      alert(`« ${f.name} » dépasse ${MAX_MB} Mo.`);
      continue;
    }
    const mediaId = `sout/${groupId}/${uid()}`;
    await db.media.put({ id: mediaId, name: f.name, blob: await fileBlob(f) });
    await db.tutoringFiles.put({
      id: uid(),
      groupId,
      sessionId,
      mediaId,
      name: f.name || 'photo.jpg',
      size: f.size,
      type: f.type,
      authorId,
      byStudent,
      createdAt: Date.now(),
    });
    n++;
  }
  return n;
}

// Avancement d'un point du programme : fixé à la main, sinon « vu » dès qu'il a été travaillé en séance
export type UnitState = UnitStatus | 'vu';
export const STATES: { key: UnitState; label: string; cls: string }[] = [
  { key: 'nonvu', label: 'Pas vu', cls: 'plain' },
  { key: 'vu', label: 'Vu', cls: 'ok' },
  { key: 'retravailler', label: 'À retravailler', cls: 'warn' },
  { key: 'acquis', label: 'Acquis', cls: 'ok' },
];
export function unitState(group: Group, seen: Map<string, string>, u: Unit): UnitState {
  return group.unitStatus?.[u.id] ?? (seen.has(u.id) ? 'vu' : 'nonvu');
}
// unitId → date de la dernière séance où il a été travaillé (une séquence est vue si une de ses séances l'est)
export function lastSeen(sessions: TutoringSession[], units: Unit[]) {
  const m = new Map<string, string>();
  const put = (id: string, d: string) => (!m.has(id) || d > m.get(id)!) && m.set(id, d);
  for (const s of sessions)
    for (const id of s.unitIds) {
      put(id, s.date);
      const parent = units.find((u) => u.id === id)?.parentId;
      if (parent) put(parent, s.date);
    }
  return m;
}
export async function setUnitStatus(group: Group, unitId: string, st: UnitState) {
  const map = { ...(group.unitStatus ?? {}) };
  if (st === 'vu') delete map[unitId];
  else map[unitId] = st;
  await db.groups.update(group.id, { unitStatus: map });
}

// Groupes de soutien d'un élève (espace élève)
export async function tutoringsOf(studentId: string) {
  const ms = await db.memberships.where('studentId').equals(studentId).toArray();
  return ((await db.groups.bulkGet(ms.map((m) => m.groupId))).filter((g) => isTutoring(g) && !g!.archived) as Group[]).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export const trackLabel = (t: Track) => `${t.subject} ${t.level}`;

// Une séance est « à venir » jusqu'à sa fin (heure de début + durée). Sans heure, elle est considérée comme faite
// dès son jour (séance notée après coup) : elle n'est à venir que si sa date est dans le futur.
export function sessionEnd(s: TutoringSession) {
  const zone = s.tz ?? DEFAULT_ZONE;
  if (!s.start) return zonedToUtc(s.date, '00:00', zone);
  return zonedToUtc(s.date, s.start, zone) + s.duration * 60000;
}
export const isUpcoming = (s: TutoringSession) => sessionEnd(s) > Date.now();

// Suspendre une flashcard pour un élève (elle sort de ses révisions, garde sa boîte) ou la reprendre
export async function setSuspended(studentId: string, cardId: string, on: boolean) {
  for (const g of await tutoringsOf(studentId)) {
    const cur = g.suspended?.[studentId] ?? [];
    const next = on ? [...new Set([...cur, cardId])] : cur.filter((x) => x !== cardId);
    await db.groups.update(g.id, { suspended: { ...(g.suspended ?? {}), [studentId]: next } });
  }
}
