// Compétences : référentiel du professeur (catégories APP, ANA, REA, VAL, COM et leurs sous-compétences),
// critères d'évaluation rattachés, niveau atteint par élève (échelle du LSU).
import { db, uid, type Evaluation, type Result } from './db';
import { dateFor } from './grading';

export interface Competence {
  id: string;
  code: string; // APP, ANA… ; sous-compétence : APP.1, APP.2…
  name: string;
  color: string;
  parentId?: string; // sous-compétence d'une catégorie
}

export const DEFAULT_COMPETENCES: Competence[] = [
  { id: 'APP', code: 'APP', name: "S'approprier", color: '#8dc9e3' },
  { id: 'ANA', code: 'ANA', name: 'Analyser', color: '#c3a6e3' },
  { id: 'REA', code: 'REA', name: 'Réaliser', color: '#f4a261' },
  { id: 'VAL', code: 'VAL', name: 'Valider', color: '#7fcdbb' },
  { id: 'COM', code: 'COM', name: 'Communiquer', color: '#e3a6b8' },
];

export async function loadCompetences(teacherId: string): Promise<Competence[]> {
  return (await db.teachers.get(teacherId))?.competences ?? DEFAULT_COMPETENCES;
}
export async function saveCompetences(teacherId: string, list: Competence[]) {
  await db.teachers.update(teacherId, { competences: list });
}

export const categories = (list: Competence[]) => list.filter((c) => !c.parentId);
export const childrenOf = (list: Competence[], id: string) => list.filter((c) => c.parentId === id);
export const categoryOf = (list: Competence[], c: Competence) => (c.parentId ? list.find((x) => x.id === c.parentId) ?? c : c);

export function newSubCompetence(list: Competence[], parent: Competence, name: string): Competence {
  const n = childrenOf(list, parent.id).length + 1;
  return { id: uid(), code: `${parent.code}.${n}`, name, color: parent.color, parentId: parent.id };
}

// ----- Échelle du LSU : vos niveaux 1-2-3-4 (25 / 50 / 75 / 100 %) -----
export const MASTERY = [
  { code: 'MI', name: 'Maîtrise insuffisante', color: '#f6c9c3' },
  { code: 'MF', name: 'Maîtrise fragile', color: '#fcdcc0' },
  { code: 'MS', name: 'Maîtrise satisfaisante', color: '#d6efc4' },
  { code: 'TBM', name: 'Très bonne maîtrise', color: '#9fd8b0' },
];
export const masteryOf = (v: number) => MASTERY[v < 0.375 ? 0 : v < 0.625 ? 1 : v < 0.875 ? 2 : 3];

// Une observation : un critère rattaché à la compétence, noté pour un élève dans une évaluation
export interface Observation {
  studentId: string;
  competenceId: string; // compétence portée par le critère
  evaluation: Evaluation;
  criterion: string;
  level: number;
  date: string;
}

export const RECENT = 3; // niveau retenu : moyenne des 3 évaluations les plus récentes (valorise la progression)

export async function observations(groupIds?: string[]): Promise<Observation[]> {
  const [evs, results, ms] = await Promise.all([db.evaluations.toArray(), db.results.toArray(), db.memberships.toArray()]);
  const groupOf = new Map<string, string[]>();
  for (const m of ms) groupOf.set(m.studentId, [...(groupOf.get(m.studentId) ?? []), m.groupId]);
  const byEval = new Map<string, Result[]>();
  for (const r of results) byEval.set(r.evaluationId, [...(byEval.get(r.evaluationId) ?? []), r]);
  const out: Observation[] = [];
  for (const ev of evs) {
    if (ev.template || !ev.criteria.some((c) => c.competenceIds?.length)) continue;
    if (groupIds && !ev.groupIds.some((g) => groupIds.includes(g))) continue;
    for (const r of byEval.get(ev.id) ?? []) {
      if (r.absent) continue;
      const gid = groupOf.get(r.studentId)?.find((g) => ev.groupIds.includes(g));
      const date = dateFor(ev, gid);
      for (const c of ev.criteria) {
        const level = r.levels[c.id];
        if (level === null || level === undefined) continue;
        for (const k of c.competenceIds ?? []) out.push({ studentId: r.studentId, competenceId: k, evaluation: ev, criterion: c.label, level, date });
      }
    }
  }
  return out;
}

// Niveau d'un élève sur une compétence (une catégorie regroupe aussi ses sous-compétences)
export function levelFor(list: Competence[], obs: Observation[], studentId: string, competenceId: string) {
  const ids = new Set([competenceId, ...childrenOf(list, competenceId).map((c) => c.id)]);
  const mine = obs.filter((o) => o.studentId === studentId && ids.has(o.competenceId));
  if (!mine.length) return null;
  // Moyenne par évaluation, puis moyenne des évaluations les plus récentes
  const perEval = new Map<string, { date: string; sum: number; n: number }>();
  for (const o of mine) {
    const e = perEval.get(o.evaluation.id) ?? { date: o.date, sum: 0, n: 0 };
    e.sum += o.level;
    e.n++;
    perEval.set(o.evaluation.id, e);
  }
  const evs = [...perEval.values()].sort((a, b) => b.date.localeCompare(a.date));
  const recent = evs.slice(0, RECENT);
  const value = recent.reduce((a, e) => a + e.sum / e.n, 0) / recent.length;
  return { value, n: mine.length, evals: evs.length, mastery: masteryOf(value) };
}

// Répartition d'une copie par compétence (catégories), pondérée par le barème :
// points obtenus / points des critères notés rattachés à la catégorie (ou à ses sous-compétences)
export interface CompetenceScore {
  c: Competence;
  note: number;
  total: number;
  value: number; // 0..1
}
export function evalCategories(list: Competence[], ev: Evaluation) {
  const used = new Set(ev.criteria.flatMap((cr) => cr.competenceIds ?? []));
  return categories(list).filter((cat) => used.has(cat.id) || childrenOf(list, cat.id).some((k) => used.has(k.id)));
}
export function competenceScores(list: Competence[], ev: Evaluation, r?: Result): CompetenceScore[] {
  if (!r || r.absent) return [];
  const out: CompetenceScore[] = [];
  for (const cat of evalCategories(list, ev)) {
    const ids = new Set([cat.id, ...childrenOf(list, cat.id).map((k) => k.id)]);
    let note = 0;
    let total = 0;
    for (const cr of ev.criteria) {
      if (!cr.competenceIds?.some((k) => ids.has(k))) continue;
      const l = r.levels[cr.id];
      if (l === null || l === undefined) continue;
      note += l * cr.points;
      total += cr.points;
    }
    if (total) out.push({ c: cat, note: Math.round(note * 10) / 10, total: Math.round(total * 10) / 10, value: note / total });
  }
  return out;
}
