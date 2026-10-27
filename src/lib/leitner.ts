// Moteur de révision : boîte de Leitner à 7 boîtes.
import { db, uid, isTutoring, type Card, type Group, type Rating, type Rule, type StudentCard, type Review } from './db';
import { unitSubject } from './units';
import { addDays, today } from './dates';

// Intervalle (en jours) avant la prochaine révision, selon la boîte atteinte.
export const INTERVALS = [0, 1, 2, 4, 8, 16, 32, 64];
export const DEFAULT_GOAL = 15;

export function nextBox(box: number, rating: Rating, rule: Rule): number {
  if (box === 0) return rating === 'easy' ? 2 : 1; // première rencontre
  if (rating === 'easy') return Math.min(7, box + 1);
  if (rating === 'hard') return box;
  return rule === 'strict' ? 1 : Math.max(1, box - 1);
}

export function applyAnswer(
  studentId: string,
  cardId: string,
  subject: string,
  prev: StudentCard | undefined,
  rating: Rating,
  rule: Rule,
  day: string,
  ts = Date.now(),
): { sc: StudentCard; review: Review } {
  const boxBefore = prev?.box ?? 0;
  const boxAfter = nextBox(boxBefore, rating, rule);
  const sc: StudentCard = {
    id: `${studentId}|${cardId}`,
    studentId,
    cardId,
    box: boxAfter,
    due: addDays(day, INTERVALS[boxAfter]),
    reps: (prev?.reps ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (rating === 'forgot' ? 1 : 0),
    lastReview: day,
  };
  return { sc, review: { id: uid(), studentId, cardId, subject, date: day, ts, rating, boxBefore, boxAfter } };
}

export interface Available {
  cardId: string;
  pubDate: string;
  order: number;
}

// Ordre de passage : cartes en retard d'abord (les plus anciennes), puis les nouvelles
// dans l'ordre de publication. Limité au nombre de cartes restant pour l'objectif du jour.
export function buildQueue(
  avail: Available[],
  scMap: Map<string, StudentCard>,
  remaining: number,
  day: string,
): string[] {
  if (remaining <= 0) return [];
  const due: StudentCard[] = [];
  const news: Available[] = [];
  for (const a of avail) {
    const sc = scMap.get(a.cardId);
    if (!sc || sc.box === 0) news.push(a);
    else if (sc.due <= day) due.push(sc);
  }
  due.sort((x, y) => (x.due < y.due ? -1 : x.due > y.due ? 1 : x.box - y.box));
  news.sort((x, y) => (x.pubDate < y.pubDate ? -1 : x.pubDate > y.pubDate ? 1 : x.order - y.order));
  return [...due.map((d) => d.cardId), ...news.map((n) => n.cardId)].slice(0, remaining);
}

// Cartes publiées (à la date `day`) dans les classes de l'élève pour une matière, et cartes de ses séances
// de soutien (celles des points du programme travaillés et celles ajoutées pendant la séance).
export async function availableCards(studentId: string, subject: string, day = today()): Promise<Available[]> {
  const ms = await db.memberships.where('studentId').equals(studentId).toArray();
  const groups = (await db.groups.bulkGet(ms.map((m) => m.groupId))).filter(
    (g) => g && !g.archived && (isTutoring(g) ? g.tracks?.some((t) => t.subject === subject) : g.subject === subject),
  ) as Group[];
  const result = new Map<string, Available>();
  const offer = (c: Card | undefined, date: string) => {
    if (!c || c.deleted) return;
    const prev = result.get(c.id);
    const order = parseInt(c.code.slice(1)) || 0;
    if (!prev || date < prev.pubDate) result.set(c.id, { cardId: c.id, pubDate: date, order });
  };
  for (const g of groups) {
    const tutoring = isTutoring(g);
    const pubs = (await db.publications.where('groupId').equals(g.id).toArray()).filter((p) => p.date <= day);
    for (const p of pubs) {
      let units = [p.unitId, ...(await db.units.where('parentId').equals(p.unitId).primaryKeys())];
      // Soutien : une séance peut mêler plusieurs matières, on ne garde que les points de cette matière
      if (tutoring) units = (await db.units.bulkGet(units)).filter((u) => u && unitSubject(u) === subject).map((u) => u!.id);
      const links = await db.unitCards.where('unitId').anyOf(units).toArray();
      for (const c of await db.cards.bulkGet(links.map((l) => l.cardId))) offer(c, p.date);
    }
    if (!tutoring) continue;
    // Flashcards ajoutées pendant une séance : rangées dans leur matière (ou la première matière suivie)
    const main = g.tracks?.[0]?.subject;
    const own = (c: Card) => (g.tracks?.some((t) => t.subject === c.subject) ? c.subject : main) === subject;
    for (const ss of await db.tutoringSessions.where('groupId').equals(g.id).toArray()) {
      if (ss.date > day || !ss.studentIds.includes(studentId)) continue;
      for (const c of await db.cards.bulkGet(ss.cardIds)) if (c && own(c)) offer(c, ss.date);
    }
  }
  // Flashcards suspendues par le professeur de soutien pour cet élève : elles ne sont plus proposées
  for (const g of groups) for (const id of g.suspended?.[studentId] ?? []) result.delete(id);
  return [...result.values()];
}

export async function studentSubjects(studentId: string): Promise<string[]> {
  const ms = await db.memberships.where('studentId').equals(studentId).toArray();
  const groups = await db.groups.bulkGet(ms.map((m) => m.groupId));
  return [...new Set(groups.filter((g) => g && !g.archived).flatMap((g) => (isTutoring(g) ? (g!.tracks ?? []).map((t) => t.subject) : [g!.subject])))];
}

export async function doneToday(studentId: string, subject: string, day = today()): Promise<number> {
  const rs = await db.reviews.where('[studentId+date]').equals([studentId, day]).toArray();
  return rs.filter((r) => r.subject === subject).length;
}

export async function todaySession(studentId: string, subject: string, extra = 0) {
  const day = today();
  const student = await db.students.get(studentId);
  const goal = student?.goals[subject] ?? DEFAULT_GOAL;
  const avail = await availableCards(studentId, subject, day);
  const scs = await db.studentCards.where('studentId').equals(studentId).toArray();
  const scMap = new Map(scs.map((s) => [s.cardId, s]));
  const done = await doneToday(studentId, subject, day);
  const queue = buildQueue(avail, scMap, goal - done + extra, day);
  const pending = buildQueue(avail, scMap, Infinity, day).length;
  return { goal, done, queue, pending, scMap };
}

export async function recordAnswer(studentId: string, cardId: string, subject: string, rating: Rating) {
  const student = await db.students.get(studentId);
  const prev = await db.studentCards.get(`${studentId}|${cardId}`);
  const { sc, review } = applyAnswer(studentId, cardId, subject, prev, rating, student?.rule ?? 'strict', today());
  await db.transaction('rw', db.studentCards, db.reviews, async () => {
    await db.studentCards.put(sc);
    await db.reviews.add(review);
  });
  return sc;
}
