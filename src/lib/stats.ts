import { db, type Review, type StudentCard, type Student } from './db';
import { addDays, diffDays, today } from './dates';
import { availableCards } from './leitner';

export const WINDOW = 30;

export interface Summary {
  activeDays: number;
  regularity: number; // 0..1
  success: number; // 0..1 (vert + orange)
  score: number; // 0..100
  total: number;
  lastDay?: string;
}

export function summarize(reviews: Review[], day = today()): Summary {
  const from = addDays(day, -WINDOW + 1);
  const recent = reviews.filter((r) => r.date >= from && r.date <= day);
  const days = new Set(recent.map((r) => r.date));
  const ok = recent.filter((r) => r.rating !== 'forgot').length;
  const regularity = days.size / WINDOW;
  const success = recent.length ? ok / recent.length : 0;
  const lastDay = reviews.reduce<string | undefined>((m, r) => (!m || r.date > m ? r.date : m), undefined);
  return {
    activeDays: days.size,
    regularity,
    success,
    score: Math.round(50 * regularity + 50 * success),
    total: recent.length,
    lastDay,
  };
}

export interface CardAgg {
  cardId: string;
  total: number;
  easy: number;
  hard: number;
  forgot: number;
  success: number;
}

export function aggregateByCard(reviews: Review[]): CardAgg[] {
  const map = new Map<string, CardAgg>();
  for (const r of reviews) {
    let a = map.get(r.cardId);
    if (!a) map.set(r.cardId, (a = { cardId: r.cardId, total: 0, easy: 0, hard: 0, forgot: 0, success: 0 }));
    a.total++;
    a[r.rating]++;
  }
  for (const a of map.values()) a.success = (a.easy + a.hard) / a.total;
  return [...map.values()];
}

// Carte difficile pour un élève : au moins 2 passages et au moins la moitié en « Je ne sais pas ».
export function difficultForStudent(reviews: Review[]): CardAgg[] {
  return aggregateByCard(reviews)
    .filter((a) => a.total >= 2 && a.forgot / a.total >= 0.5)
    .sort((x, y) => x.success - y.success || y.total - x.total);
}

export function heatmapCounts(reviews: Review[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of reviews) m.set(r.date, (m.get(r.date) ?? 0) + 1);
  return m;
}

export function streak(counts: Map<string, number>, day = today()): number {
  let d = counts.has(day) ? day : addDays(day, -1);
  let n = 0;
  while (counts.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// Répartition par boîte : index 0 = jamais vue, 1..7 = boîtes.
export async function boxDistribution(studentId: string, subject: string): Promise<number[]> {
  const avail = await availableCards(studentId, subject);
  const scs = await db.studentCards.where('studentId').equals(studentId).toArray();
  const scMap = new Map(scs.map((s) => [s.cardId, s]));
  const dist = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const a of avail) dist[scMap.get(a.cardId)?.box ?? 0]++;
  return dist;
}

export interface StudentRow {
  student: Student;
  summary: Summary;
  inactiveDays: number | null;
}

export async function groupOverview(groupId: string) {
  const group = await db.groups.get(groupId);
  if (!group) return null;
  const ms = await db.memberships.where('groupId').equals(groupId).toArray();
  const students = (await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[];
  const day = today();
  const allReviews: Review[] = [];
  const rows: StudentRow[] = [];
  for (const s of students) {
    const rs = (await db.reviews.where('studentId').equals(s.id).toArray()).filter((r) => r.subject === group.subject);
    allReviews.push(...rs);
    const summary = summarize(rs, day);
    rows.push({ student: s, summary, inactiveDays: summary.lastDay ? diffDays(day, summary.lastDay) : null });
  }
  rows.sort((a, b) => b.summary.score - a.summary.score);
  const cards = aggregateByCard(allReviews)
    .filter((a) => a.total >= 3)
    .sort((x, y) => x.success - y.success);
  return { group, rows, cards, reviews: allReviews };
}

export async function cardByGroup(cardId: string) {
  const card = await db.cards.get(cardId);
  if (!card) return [];
  const groups = (await db.groups.toArray()).filter((g) => g.subject === card.subject && !g.archived);
  const reviews = await db.reviews.where('cardId').equals(cardId).toArray();
  const out = [];
  for (const g of groups) {
    const ids = new Set((await db.memberships.where('groupId').equals(g.id).toArray()).map((m) => m.studentId));
    const rs = reviews.filter((r) => ids.has(r.studentId));
    const [agg] = aggregateByCard(rs);
    out.push({ group: g, agg });
  }
  return out;
}

export type { StudentCard };
