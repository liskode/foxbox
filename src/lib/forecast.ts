// Progression d'un niveau : séances faites (publiées) par classe, dates prévisionnelles calculées
// à partir de l'emploi du temps et du calendrier (vacances, jours fériés), fin de programme prévue.
import { db, uid, type Group, type Publication, type Unit } from './db';
import { addDays, today } from './dates';
import { countsForProgress, loadTimetable, matchGroup, minutes, slotsOn, type Timetable } from './timetable';
import { LEVELS, levelOfName } from './units';

export const durationOf = (u: Unit) => u.duration ?? 1;
export const classCode = (g: Group) => g.name.toUpperCase().match(/^\s*(\d[A-Z])/)?.[1];
export const groupsOfLevel = (groups: Group[], level: string) =>
  groups.filter((g) => !g.archived && levelOfName(g.name) === level).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));

// Séquences d'un niveau dans l'ordre de la Bibliothèque (thème puis code)
export const sequencesOf = (units: Unit[], level: string) =>
  units
    .filter((u) => u.kind === 'sequence' && u.level === level)
    .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', 'fr', { numeric: true }) || a.order - b.order);
export const seancesOf = (units: Unit[], seq: Unit) => units.filter((u) => u.parentId === seq.id).sort((a, b) => a.order - b.order);

// Unités à faire, dans l'ordre : chaque séance, ou la séquence elle-même si elle n'a pas de séance
export interface Item {
  unit: Unit;
  seq: Unit;
}
export function itemsOf(units: Unit[], level: string): Item[] {
  return sequencesOf(units, level).flatMap((seq) => {
    const ss = seancesOf(units, seq);
    return ss.length ? ss.map((unit) => ({ unit, seq })) : [{ unit: seq, seq }];
  });
}

// Heures de cours d'une classe un jour donné. Les demi-groupes ([6B1] puis [6B2]) font la même séance :
// on ne la compte qu'une fois. Un cours de 2 h compte pour 2.
export function classHours(tt: Timetable, g: Group, groups: Group[], date: string): number {
  const code = classCode(g);
  let whole = 0;
  const halves = new Map<string, number>();
  for (const s of slotsOn(tt, date)) {
    if (!countsForProgress(s)) continue;
    const sg = (s.groupId && groups.find((x) => x.id === s.groupId)) || matchGroup(s.label, groups);
    if (sg?.id !== g.id) continue;
    const h = Math.max(1, Math.round((minutes(s.end) - minutes(s.start)) / 55));
    const lab = s.label.replace(/[[\]]/g, '').toUpperCase();
    if (lab === code) whole += h;
    else halves.set(lab, (halves.get(lab) ?? 0) + h);
  }
  return whole + Math.max(0, ...halves.values());
}

export const yearEnd = (tt: Timetable) => {
  const keys = Object.keys(tt.weeks).sort();
  return keys.length ? addDays(keys[keys.length - 1], 4) : addDays(today(), 300);
};

export function courseDays(tt: Timetable, g: Group, groups: Group[], from: string, to: string) {
  const out: { date: string; hours: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const hours = classHours(tt, g, groups, d);
    if (hours) out.push({ date: d, hours });
  }
  return out;
}

// Derniers jours de cours de la classe (jusqu'à aujourd'hui inclus), du plus récent au plus ancien
export function recentCourseDays(tt: Timetable, g: Group, groups: Group[], n = 6) {
  const out: string[] = [];
  for (let i = 0, d = today(); i < 90 && out.length < n; i++, d = addDays(d, -1)) if (classHours(tt, g, groups, d)) out.push(d);
  return out;
}

export interface ClassPlan {
  done: Map<string, string>; // unitId → date où la séance a été faite
  planned: Map<string, string>; // unitId → date prévisionnelle
  end?: string; // fin de programme prévue
  overflowWeeks: number; // semaines manquantes pour finir le programme
  hasTimetable: boolean;
}

export function planClass(tt: Timetable, g: Group, groups: Group[], items: Item[], pubs: Publication[]): ClassPlan {
  const done = new Map<string, string>();
  for (const p of pubs) if (p.groupId === g.id && (!done.has(p.unitId) || p.date < done.get(p.unitId)!)) done.set(p.unitId, p.date);
  const isDone = (it: Item) => done.has(it.unit.id) || done.has(it.seq.id);
  const planned = new Map<string, string>();
  const t = today();
  // Les prévisions partent du prochain cours (aujourd'hui compris, sauf si une séance a déjà été faite aujourd'hui)
  const from = [...done.values()].includes(t) ? addDays(t, 1) : t;
  const end = yearEnd(tt);
  const days = courseDays(tt, g, groups, from, end);
  const hasTimetable = days.length > 0;
  let i = 0;
  let left = days[0]?.hours ?? 0;
  let last: string | undefined;
  let missing = 0;
  for (const it of items) {
    if (isDone(it)) continue;
    let need = durationOf(it.unit);
    while (i < days.length && left <= 0) left = days[++i]?.hours ?? 0;
    if (i >= days.length) {
      missing += need;
      continue;
    }
    planned.set(it.unit.id, days[i].date);
    while (need > 0 && i < days.length) {
      const take = Math.min(need, left);
      need -= take;
      left -= take;
      last = days[i].date;
      if (need > 0) left = days[++i]?.hours ?? 0;
    }
    missing += need;
  }
  // Semaines manquantes : heures restantes ÷ heures par semaine de la classe
  let overflowWeeks = 0;
  if (missing > 0) {
    const yearDays = courseDays(tt, g, groups, Object.keys(tt.weeks).sort()[0] ?? from, end);
    const weekly = yearDays.reduce((a, d) => a + d.hours, 0) / Math.max(1, Object.keys(tt.weeks).length);
    overflowWeeks = weekly ? Math.ceil(missing / weekly) : 0;
  }
  return { done, planned, end: missing ? undefined : last, overflowWeeks, hasTimetable };
}

export interface LevelPlan {
  level: string;
  groups: Group[];
  items: Item[];
  plans: Map<string, ClassPlan>; // groupId → plan
}

export async function levelPlans(teacherId: string): Promise<{ tt: Timetable; units: Unit[]; levels: LevelPlan[] }> {
  const [tt, units, allGroups, pubs] = await Promise.all([loadTimetable(teacherId), db.units.toArray(), db.groups.toArray(), db.publications.toArray()]);
  const active = allGroups.filter((g) => !g.archived);
  const levels = LEVELS.map((level) => {
    const groups = groupsOfLevel(active, level);
    const items = itemsOf(units, level);
    return { level, groups, items, plans: new Map(groups.map((g) => [g.id, planClass(tt, g, active, items, pubs)])) };
  });
  return { tt, units, levels };
}

// Une unité (séance, ou séquence sans séance) est-elle faite par la classe ?
export const doneDate = (plan: ClassPlan | undefined, it: Item) => plan?.done.get(it.unit.id) ?? plan?.done.get(it.seq.id);
export const finishedByAll = (lp: LevelPlan, items: Item[]) =>
  lp.groups.length > 0 && items.length > 0 && lp.groups.every((g) => items.every((it) => doneDate(lp.plans.get(g.id), it)));

// Cocher « faite » : publie les cartes de la séance pour la classe, à la date du cours
export async function markDone(groupId: string, unitId: string, date: string) {
  const old = await db.publications.where('groupId').equals(groupId).filter((p) => p.unitId === unitId).toArray();
  await db.publications.bulkDelete(old.map((p) => p.id));
  await db.publications.put({ id: uid(), groupId, unitId, date });
}
export async function unmarkDone(groupId: string, unitId: string) {
  const old = await db.publications.where('groupId').equals(groupId).filter((p) => p.unitId === unitId).toArray();
  await db.publications.bulkDelete(old.map((p) => p.id));
}

export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
