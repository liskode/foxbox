// Vérifications automatiques des calculs sensibles (notes, compétences, boîtes de flashcards, facturation du soutien).
// Lancées avant chaque publication : une erreur de calcul bloque la mise en ligne.
import { describe, expect, it } from 'vitest';
import type { Billing, Evaluation, Payment, Result, StudentCard, TutoringSession } from '../src/lib/db';
import { faceOf, LEVEL_KEYS, maxPoints, score, stats } from '../src/lib/grading';
import { competenceScores, DEFAULT_COMPETENCES, masteryOf, subCompetenceScores } from '../src/lib/competences';
import { applyAnswer, buildQueue, INTERVALS, nextBox } from '../src/lib/leitner';
import { buildLedger, hoursLabel, monthSummary, rateAt } from '../src/lib/billing';
import { DEFAULT_GRADE_COLORS, levelCategory, overallColor } from '../src/lib/gradeColors';
import { addDays, diffDays } from '../src/lib/dates';

const ev = {
  id: 'ev',
  name: 'DS',
  criteria: [
    { id: 'a', label: 'Q1', points: 2, competenceIds: ['APP'] },
    { id: 'b', label: 'Q2', points: 3, competenceIds: ['ANA.1'] },
    { id: 'c', label: 'Q3', points: 5, competenceIds: ['ANA.1', 'REA'] },
  ],
} as unknown as Evaluation;
const result = (levels: Record<string, number | null>, absent = false) => ({ id: 'r', evaluationId: 'ev', studentId: 's', levels, absent }) as unknown as Result;

describe('Notes', () => {
  it('additionne les points selon le niveau de chaque critère et ramène sur 20', () => {
    expect(score(ev, result({ a: 1, b: 0.4, c: 0.8 }))).toEqual({ note: 7.2, total: 10, note20: 14.4, graded: 3 });
  });
  it('neutralise un critère non noté', () => {
    expect(score(ev, result({ a: 1, b: null, c: 0.8 }))).toEqual({ note: 6, total: 7, note20: 17.1, graded: 2 });
  });
  it('ne donne pas de note à un absent ni à une copie vide', () => {
    expect(score(ev, result({ a: 1 }, true))).toBeNull();
    expect(score(ev, result({}))).toBeNull();
    expect(score(ev, undefined)).toBeNull();
  });
  it('barème total et touches 1 à 4', () => {
    expect(maxPoints(ev)).toBe(10);
    expect(LEVEL_KEYS).toEqual({ '1': 0, '2': 0.4, '3': 0.8, '4': 1 });
    expect([0, 0.4, 0.8, 1].map(faceOf)).toEqual([0, 1, 2, 3]);
  });
  it('moyenne de la classe', () => {
    expect(stats([])).toBeNull();
    expect(stats([10, 14])!.mean).toBe(12);
  });
});

describe('Couleurs de réussite', () => {
  it('range une moyenne dans la bonne couleur (seuils 30 / 50 / 65 / 80 / 90)', () => {
    const c = DEFAULT_GRADE_COLORS.overall.colors;
    expect([0.29, 0.3, 0.5, 0.65, 0.8, 0.9].map((v) => overallColor(v))).toEqual(c);
    expect(overallColor(null)).toBeUndefined();
  });
  it('range un niveau dans les catégories 1 à 4', () => {
    expect([0, 0.4, 0.8, 1].map((v) => levelCategory(v))).toEqual([0, 1, 2, 3]);
  });
});

describe('Compétences', () => {
  const list = DEFAULT_COMPETENCES;
  it('calcule la réussite par compétence, sous-compétences comprises', () => {
    const by = Object.fromEntries(competenceScores(list, ev, result({ a: 1, b: 0.4, c: 0.8 })).map((x) => [x.c.id, x]));
    expect(by.APP.value).toBe(1);
    expect(by.ANA.note).toBe(5.2); // 3 × 0,4 + 5 × 0,8
    expect(by.ANA.total).toBe(8);
    expect(by.REA.value).toBeCloseTo(0.8);
  });
  it('ignore les absents', () => {
    expect(competenceScores(list, ev, result({ a: 1 }, true))).toEqual([]);
  });
  it('détaille une sous-compétence sur plusieurs copies', () => {
    const subs = subCompetenceScores(list, [
      { ev, r: result({ a: 1, b: 0.4, c: 0.8 }) },
      { ev, r: result({ a: 0, b: 1, c: 1 }) },
    ]);
    const ana1 = [...subs.values()].find((x) => x.c.id === 'ANA.1')!;
    expect(ana1.total).toBe(16);
    expect(ana1.note).toBeCloseTo(13.2);
  });
  it('niveaux de maîtrise', () => {
    expect([0.3, 0.5, 0.7, 0.9].map((v) => masteryOf(v).code)).toEqual(['MI', 'MF', 'MS', 'TBM']);
  });
});

describe('Flashcards (boîtes de Leitner)', () => {
  it('fait avancer, rester ou reculer une flashcard', () => {
    expect(nextBox(0, 'easy', 'strict')).toBe(2);
    expect(nextBox(0, 'forgot', 'strict')).toBe(1);
    expect(nextBox(3, 'easy', 'strict')).toBe(4);
    expect(nextBox(7, 'easy', 'strict')).toBe(7);
    expect(nextBox(3, 'hard', 'strict')).toBe(3);
    expect(nextBox(5, 'forgot', 'strict')).toBe(1);
    expect(nextBox(5, 'forgot', 'douce')).toBe(4);
    expect(nextBox(1, 'forgot', 'douce')).toBe(1);
  });
  it('fixe la prochaine révision selon la boîte', () => {
    const prev: StudentCard = { id: 's|c', studentId: 's', cardId: 'c', box: 3, due: '2026-11-10', reps: 4, lapses: 1 };
    const { sc, review } = applyAnswer('s', 'c', 'Physique-Chimie', prev, 'easy', 'strict', '2026-11-10', 0);
    expect(sc.box).toBe(4);
    expect(sc.due).toBe(addDays('2026-11-10', INTERVALS[4]));
    expect(sc.due).toBe('2026-11-18');
    expect(sc.reps).toBe(5);
    expect(sc.lapses).toBe(1);
    expect(review.boxBefore).toBe(3);
    expect(applyAnswer('s', 'c', 'x', prev, 'forgot', 'strict', '2026-11-10', 0).sc.lapses).toBe(2);
  });
  it('présente les flashcards en retard avant les nouvelles, dans la limite de l’objectif', () => {
    const sc = (cardId: string, box: number, due: string): [string, StudentCard] => [cardId, { id: cardId, studentId: 's', cardId, box, due, reps: 1, lapses: 0 }];
    const avail = ['n2', 'late', 'future', 'n1', 'later'].map((cardId, order) => ({ cardId, pubDate: cardId === 'n1' ? '2026-11-01' : '2026-11-05', order }));
    const map = new Map([sc('late', 2, '2026-11-08'), sc('later', 3, '2026-11-09'), sc('future', 4, '2026-11-20')]);
    expect(buildQueue(avail, map, 10, '2026-11-10')).toEqual(['late', 'later', 'n1', 'n2']);
    expect(buildQueue(avail, map, 3, '2026-11-10')).toEqual(['late', 'later', 'n1']);
    expect(buildQueue(avail, map, 0, '2026-11-10')).toEqual([]);
  });
});

describe('Facturation du soutien', () => {
  const session = (id: string, date: string, duration: number, studentIds = ['s']) => ({ id, groupId: 'g', date, duration, studentIds, place: 'domicile', unitIds: [], cardIds: [], done: '', homework: '', links: [], createdAt: 0 }) as TutoringSession;
  const billing = { id: 't|s', teacherId: 't', studentId: 's', mode: 'seance', rates: [{ from: '2026-09-01', hourly: 30 }, { from: '2026-10-15', hourly: 40 }] } as unknown as Billing;
  const pay = (date: string, amount: number) => ({ id: date, teacherId: 't', studentId: 's', date, amount, method: 'Virement', createdAt: 0 }) as Payment;
  const sessions = [session('1', '2026-10-01', 60), session('2', '2026-10-20', 90), session('3', '2026-10-22', 60, ['autre'])];

  it('applique le tarif en vigueur à la date de la séance', () => {
    expect(rateAt(billing, '2026-08-01')).toBeUndefined();
    expect(rateAt(billing, '2026-10-01')).toBe(30);
    expect(rateAt(billing, '2026-10-15')).toBe(40);
  });
  it('ne facture que les séances où l’élève était présent', () => {
    const l = buildLedger('s', sessions, billing, []);
    expect(l.lines.map((x) => x.amount)).toEqual([30, 60]);
    expect(l.due).toBe(90);
    expect(l.hours).toBe(2.5);
    expect(l.balance).toBe(-90);
  });
  it('répartit les règlements sur les séances les plus anciennes', () => {
    const l = buildLedger('s', sessions, billing, [pay('2026-10-05', 50)]);
    expect(l.lines.map((x) => [x.paid, x.partly])).toEqual([[true, false], [false, true]]);
    expect(l.balance).toBe(-40);
    expect(buildLedger('s', sessions, billing, [pay('2026-10-05', 100)]).balance).toBe(10);
  });
  it('signale un tarif manquant', () => {
    expect(buildLedger('s', sessions, undefined, []).missingRate).toBe(true);
  });
  it('récapitule un mois', () => {
    const m = monthSummary(buildLedger('s', sessions, billing, [pay('2026-10-05', 50)]), '2026-10');
    expect(m.due).toBe(90);
    expect(m.received).toBe(50);
    expect(m.unpaid).toBe(60);
    expect(hoursLabel(m.hours)).toBe('2 h 30');
  });
});

describe('Dates', () => {
  it('ajoute des jours en passant les mois et le changement d’heure', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-11-10', '2026-10-10')).toBe(31);
  });
});
