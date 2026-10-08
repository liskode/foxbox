// Calculs de l'onglet Correction : notes, statistiques, partage avec l'élève, lien avec les cartes.
import { db, uid, type Evaluation, type Result, type ResultShare, type Student } from './db';
import { today } from './dates';

export const round1 = (x: number) => Math.round(x * 10) / 10;

// Date de l'évaluation pour une classe (chaque classe peut passer l'évaluation un jour différent)
export const dateFor = (ev: Evaluation, groupId?: string) => (groupId && ev.groupDates?.[groupId]) || ev.date;

async function groupOfStudent(ev: Evaluation, studentId: string) {
  const ms = await db.memberships.where('studentId').equals(studentId).toArray();
  return ms.find((m) => ev.groupIds.includes(m.groupId))?.groupId;
}
export const FAIL_LEVEL = 0.25; // critère raté : niveau ≤ 25 %

// Raccourcis clavier (rangée du haut d'un clavier canadien) : / 1 2 3 4
export const LEVEL_KEYS: Record<string, number> = { '/': 0, '1': 0.25, '2': 0.5, '3': 0.75, '4': 1 };
export const LEVELS = [0, 0.25, 0.5, 0.75, 1];

export interface Score {
  note: number; // points obtenus
  total: number; // points des critères notés
  note20: number;
  graded: number; // nombre de critères notés
}

// Un critère « non noté » est neutralisé (ni dans les points, ni dans le total). Absent : pas de note.
export function score(ev: Evaluation, r?: Result): Score | null {
  if (!r || r.absent) return null;
  let note = 0;
  let total = 0;
  let graded = 0;
  for (const c of ev.criteria) {
    const l = r.levels[c.id];
    if (l === null || l === undefined) continue;
    note += l * c.points;
    total += c.points;
    graded++;
  }
  if (!graded) return null;
  return { note: round1(note), total: round1(total), note20: total ? round1((note / total) * 20) : 0, graded };
}

export const maxPoints = (ev: Evaluation) => round1(ev.criteria.reduce((a, c) => a + c.points, 0));

export function levelColor(l: number | null | undefined) {
  if (l === null || l === undefined) return 'transparent';
  if (l <= 0.25) return '#f6c9c3';
  if (l < 0.75) return '#fcdcc0';
  return '#cfece4';
}

export function stats(values: number[]) {
  if (!values.length) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return { mean: round1(mean), sd: round1(sd), min: round1(Math.min(...values)), max: round1(Math.max(...values)), n: values.length };
}

export async function studentsOf(ev: Evaluation): Promise<{ student: Student; groupId: string }[]> {
  const out: { student: Student; groupId: string }[] = [];
  const seen = new Set<string>();
  for (const gid of ev.groupIds) {
    const ms = await db.memberships.where('groupId').equals(gid).toArray();
    const ss = (await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[];
    ss.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    for (const s of ss) if (!seen.has(s.id)) (seen.add(s.id), out.push({ student: s, groupId: gid }));
  }
  return out;
}

// ----- Partage avec l'élève, selon les réglages de visibilité -----
function shareOf(ev: Evaluation, r: Result, date: string): ResultShare | null {
  const v = ev.visibility;
  if (!v.note && !v.appreciation && !v.detail) return null;
  const s = score(ev, r);
  if (!s && !r.absent && !r.appreciation) return null; // pas encore corrigé
  const share: ResultShare = { id: r.id, evaluationId: ev.id, studentId: r.studentId, name: ev.name, date, absent: r.absent };
  if (v.note && s) Object.assign(share, { note: s.note, total: s.total, note20: s.note20 });
  if (v.appreciation && r.appreciation?.trim()) share.appreciation = r.appreciation.trim();
  if (v.detail && !r.absent) share.detail = ev.criteria.map((c) => ({ label: c.label, points: c.points, level: r.levels[c.id] ?? null }));
  return share;
}

export async function syncShare(ev: Evaluation, r: Result) {
  const share = ev.template ? null : shareOf(ev, r, dateFor(ev, await groupOfStudent(ev, r.studentId)));
  if (share) await db.resultShares.put(share);
  else if (await db.resultShares.get(r.id)) await db.resultShares.delete(r.id);
}

export async function syncAllShares(ev: Evaluation) {
  const rs = await db.results.where('evaluationId').equals(ev.id).toArray();
  for (const r of rs) await syncShare(ev, r);
}

export async function saveResult(ev: Evaluation, r: Result) {
  const next = { ...r, updatedAt: Date.now() };
  await db.results.put(next);
  await syncShare(ev, next);
}

export function emptyResult(ev: Evaluation, studentId: string): Result {
  return { id: `${ev.id}|${studentId}`, evaluationId: ev.id, studentId, levels: {}, updatedAt: Date.now() };
}

// ----- Lien avec les cartes : un critère raté remet ses cartes en boîte 1 pour l'élève -----
export async function resetCardsForFailures(ev: Evaluation): Promise<{ students: number; cards: number }> {
  const rs = await db.results.where('evaluationId').equals(ev.id).toArray();
  const day = today();
  let students = 0;
  let cards = 0;
  for (const r of rs) {
    if (r.absent) continue;
    const ids = new Set<string>();
    for (const c of ev.criteria) {
      const l = r.levels[c.id];
      if (l !== null && l !== undefined && l <= FAIL_LEVEL) c.cardIds?.forEach((id) => ids.add(id));
    }
    if (!ids.size) continue;
    students++;
    for (const cardId of ids) {
      const key = `${r.studentId}|${cardId}`;
      const prev = await db.studentCards.get(key);
      await db.studentCards.put({
        id: key,
        studentId: r.studentId,
        cardId,
        box: 1,
        due: day,
        reps: prev?.reps ?? 0,
        lapses: (prev?.lapses ?? 0) + 1,
        lastReview: prev?.lastReview,
      });
      cards++;
    }
    await db.results.update(r.id, { cardsResetAt: Date.now() });
  }
  return { students, cards };
}

export function newEvaluation(subject: string, groupIds: string[]): Evaluation {
  return {
    id: uid(),
    name: 'Nouvelle évaluation',
    date: today(),
    subject,
    groupIds,
    criteria: [],
    visibility: { note: true, appreciation: true, detail: false },
    createdAt: Date.now(),
  };
}

export function duplicate(ev: Evaluation): Evaluation {
  return {
    ...ev,
    id: uid(),
    name: ev.template ? ev.name : `${ev.name} (copie)`,
    date: today(),
    template: false,
    groupIds: ev.template ? [] : ev.groupIds,
    criteria: ev.criteria.map((c) => ({ ...c, id: uid() })),
    createdAt: Date.now(),
  };
}

// « Coller depuis Excel » : une ligne par critère, barème éventuel en dernière colonne (tabulation ou ;)
export function parseCriteria(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/\t|;/).map((p) => p.trim()).filter(Boolean);
      const last = parts[parts.length - 1]?.replace(',', '.');
      const pts = parts.length > 1 && /^\d+(\.\d+)?$/.test(last) ? parseFloat(last) : 1;
      const label = parts.length > 1 && /^\d+(\.\d+)?$/.test(last) ? parts.slice(0, -1).join(' ') : parts.join(' ');
      return { id: uid(), label, points: pts };
    });
}

