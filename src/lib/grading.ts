// Calculs de l'onglet Correction : notes, statistiques, partage avec l'élève, lien avec les cartes.
import { db, byName, groupStudents, isClass, uid, SUBJECTS, type Evaluation, type Group, type Result, type ResultShare, type Student, type Unit } from './db';
import { levelOfName, nextSeanceCode } from './units';
import { competenceScores, loadCompetences, type Competence } from './competences';
import { today } from './dates';

export const round1 = (x: number) => Math.round(x * 10) / 10;

// Date de l'évaluation pour une classe (chaque classe peut passer l'évaluation un jour différent)
export const dateFor = (ev: Evaluation, groupId?: string) => (groupId && ev.groupDates?.[groupId]) || ev.date;

async function groupOfStudent(ev: Evaluation, studentId: string) {
  const ms = await db.memberships.where('studentId').equals(studentId).toArray();
  return ms.find((m) => ev.groupIds.includes(m.groupId))?.groupId;
}
export const FAIL_LEVEL = 0.4; // critère raté : niveau ≤ 40 %

// 4 niveaux (comme les 4 visages de l'autocorrection) : touches 1 2 3 4 = 0 · 40 · 80 · 100 %
export const LEVEL_KEYS: Record<string, number> = { '1': 0, '2': 0.4, '3': 0.8, '4': 1 };
export const LEVELS = [0, 0.4, 0.8, 1];
// Niveau le plus proche parmi les 4 (pour l'afficher en visage) : 0 à 3
export const faceOf = (l: number) => (l < 0.2 ? 0 : l < 0.6 ? 1 : l < 0.9 ? 2 : 3);

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
  if (l < 0.3) return '#f6c9c3';
  if (l < 0.7) return '#fcdcc0';
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
    const ss = await groupStudents(gid);
    ss.sort(byName);
    for (const s of ss) if (!seen.has(s.id)) (seen.add(s.id), out.push({ student: s, groupId: gid }));
  }
  return out;
}

// ----- Partage avec l'élève, selon les réglages de visibilité -----
// Autocorrection : l'élève n'a accès à rien avant que les copies de sa classe soient rendues ; il voit alors le barème
// (sans ses résultats), et la correction du professeur une fois son autocorrection terminée.
function shareOf(ev: Evaluation, r: Result, date: string, comps: Competence[], groupId?: string): ResultShare | null {
  const v = ev.visibility;
  const showComp = v.competences ?? true;
  const self = !!v.selfCheck;
  if (self && !(groupId && ev.returned?.[groupId])) return null;
  if (!self && !v.note && !v.appreciation && !v.detail && !showComp) return null;
  const s = score(ev, r);
  if (!s && !r.absent && !r.appreciation) return null; // pas encore corrigé
  const share: ResultShare = { id: r.id, evaluationId: ev.id, studentId: r.studentId, name: ev.name, date, absent: r.absent, teacherId: ev.ownerId };
  if (self && !r.absent) share.selfCheck = ev.criteria.map((c) => ({ id: c.id, label: c.label, points: c.points }));
  if (v.note && s) Object.assign(share, { note: s.note, total: s.total, note20: s.note20 });
  if (v.appreciation && r.appreciation?.trim()) share.appreciation = r.appreciation.trim();
  if (showComp && !r.absent) {
    const cs = competenceScores(comps, ev, r).map(({ c, note, total }) => ({ code: c.code, name: c.name, color: c.color, note, total }));
    if (cs.length) share.competences = cs;
  }
  if (v.detail && !r.absent) share.detail = ev.criteria.map((c) => ({ id: c.id, label: c.label, points: c.points, level: r.levels[c.id] ?? null }));
  return share;
}

export async function syncShare(ev: Evaluation, r: Result) {
  const teacherId = ev.ownerId ?? (await db.teachers.toCollection().first())?.id ?? '';
  const gid = await groupOfStudent(ev, r.studentId);
  const share = ev.template ? null : shareOf(ev, r, dateFor(ev, gid), await loadCompetences(teacherId), gid);
  if (share && !share.teacherId) share.teacherId = teacherId;
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

// ----- Lien avec les cartes : critère à 0 % (ou presque) → ses flashcards reviennent en boîte 1 ; à 40 % → elles reculent d'une boîte -----
export async function resetCardsForFailures(ev: Evaluation): Promise<{ students: number; cards: number }> {
  const rs = await db.results.where('evaluationId').equals(ev.id).toArray();
  const day = today();
  let students = 0;
  let cards = 0;
  for (const r of rs) {
    if (r.absent) continue;
    const back = new Map<string, boolean>(); // flashcard -> retour en boîte 1 (sinon : une boîte de moins)
    for (const c of ev.criteria) {
      const l = r.levels[c.id];
      if (l !== null && l !== undefined && l <= FAIL_LEVEL) c.cardIds?.forEach((id) => back.set(id, back.get(id) || l <= 0.25));
    }
    if (!back.size) continue;
    students++;
    for (const [cardId, toOne] of back) {
      const key = `${r.studentId}|${cardId}`;
      const prev = await db.studentCards.get(key);
      await db.studentCards.put({
        id: key,
        studentId: r.studentId,
        cardId,
        box: toOne || !prev ? 1 : Math.max(1, prev.box - 1),
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
    groupDates: ev.template ? {} : ev.groupDates,
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


// ----- Évaluations rattachées à un niveau et à une séance d'évaluation de la Progression -----
export const levelOfEval = (ev: Evaluation, groups: Group[]) =>
  ev.level ?? ev.groupIds.map((id) => levelOfName(groups.find((g) => g.id === id)?.name ?? '')).find(Boolean);

// Crée une séance « Évaluation » en fin de séquence ; si aucune évaluation n'existe, en crée une pour toutes les classes du niveau
export async function createEvalSeance(seq: Unit, existing?: Evaluation): Promise<{ unit: Unit; ev: Evaluation }> {
  const kids = await db.units.where('parentId').equals(seq.id).toArray();
  const unit: Unit = {
    id: uid(),
    kind: 'seance',
    parentId: seq.id,
    subject: seq.subject,
    level: seq.level,
    theme: seq.theme,
    name: existing?.name ?? `Évaluation – ${seq.name}`,
    order: kids.length + 1,
    code: await nextSeanceCode(seq),
    isEval: true,
  };
  await db.units.put(unit);
  let ev = existing;
  if (ev) {
    ev = { ...ev, unitId: unit.id, level: seq.level };
  } else {
    const groups = (await db.groups.toArray()).filter((g) => !g.archived && isClass(g) && levelOfName(g.name) === seq.level);
    ev = { ...newEvaluation(SUBJECTS[0], groups.map((g) => g.id)), name: unit.name, level: seq.level, unitId: unit.id };
  }
  await db.evaluations.put(ev);
  return { unit, ev };
}

// Séance d'évaluation cochée « faite » pour une classe : la date du cours devient la date de l'évaluation pour cette classe.
// Renvoie l'évaluation (la variante) qui concerne la classe.
export async function evalDone(unitId: string, groupId: string, date: string): Promise<Evaluation | undefined> {
  const evs = (await db.evaluations.toArray()).filter((e) => e.unitId === unitId && !e.template);
  let ev = evs.find((e) => e.groupIds.includes(groupId));
  if (!ev && evs.length) ev = { ...evs[0], groupIds: [...evs[0].groupIds, groupId] };
  if (!ev) return undefined;
  ev = { ...ev, groupDates: { ...(ev.groupDates ?? {}), [groupId]: date } };
  await db.evaluations.put(ev);
  await syncAllShares(ev);
  return ev;
}

// Variante : copie de l'évaluation pour d'autres classes du même niveau (même séance d'évaluation)
export function variantOf(ev: Evaluation): Evaluation {
  return { ...duplicate(ev), name: `${ev.name} (variante)`, groupIds: [], groupDates: {} };
}

// Une classe ne passe qu'une variante d'une même séance d'évaluation
export async function assignClass(ev: Evaluation, groupId: string, on: boolean) {
  if (on && ev.unitId) {
    const siblings = (await db.evaluations.toArray()).filter((e) => e.id !== ev.id && e.unitId === ev.unitId && e.groupIds.includes(groupId));
    for (const s of siblings) await db.evaluations.update(s.id, { groupIds: s.groupIds.filter((x) => x !== groupId) });
  }
  await db.evaluations.update(ev.id, { groupIds: on ? [...new Set([...ev.groupIds, groupId])] : ev.groupIds.filter((x) => x !== groupId) });
}

// Modèle : cocher une classe crée l'évaluation (copie du modèle) pour cette classe. Avec une séquence, elle va dans
// la séance d'évaluation de la séquence (variante des évaluations déjà prévues, qui perdent la classe), ou dans une
// nouvelle séance en fin de séquence. Une évaluation prévue restée vide et sans classe est retirée.
// Renvoie la nouvelle évaluation et de quoi annuler.
export async function evalFromTemplate(t: Evaluation, groupId: string, seq?: Unit) {
  let ev: Evaluation = { ...duplicate(t), seqId: undefined, groupIds: [], level: seq?.level ?? t.level };
  let created: Unit | undefined;
  const seance = seq && (await db.units.where('parentId').equals(seq.id).toArray()).filter((u) => u.isEval).sort((a, b) => a.order - b.order).pop();
  const before = seance ? (await db.evaluations.toArray()).filter((e) => e.unitId === seance.id) : [];
  if (seance) ev = { ...ev, unitId: seance.id };
  if (seq && !seance) ({ unit: created, ev } = await createEvalSeance(seq, ev));
  else await db.evaluations.put(ev);
  await assignClass(ev, groupId, true);
  for (const b of before) {
    const now = await db.evaluations.get(b.id);
    const results = await db.results.where('evaluationId').equals(b.id).count();
    if (now && !now.groupIds.length && !now.criteria.length && !now.documents?.length && !results) await db.evaluations.delete(b.id);
  }
  const undo = async () => {
    await db.evaluations.delete(ev.id);
    if (created) await db.units.delete(created.id);
    await db.evaluations.bulkPut(before);
  };
  return { ev, undo };
}

// Notes d'une classe pour Pronote : une ligne par élève (ordre alphabétique), sur 20, « Abs » si absent
export function pronoteColumn(ev: Evaluation, list: { student: Student; groupId: string }[], results: Map<string, Result>, groupId: string) {
  return list
    .filter((x) => x.groupId === groupId)
    .map(({ student }) => {
      const r = results.get(student.id);
      if (r?.absent) return 'Abs';
      const s = score(ev, r);
      return s ? String(s.note20).replace('.', ',') : '';
    })
    .join('\n');
}
