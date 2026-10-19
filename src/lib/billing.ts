// Soutien scolaire : tarifs, montants des séances, règlements et soldes.
// Les règlements couvrent les séances dans l'ordre chronologique : une séance est « réglée » quand le total payé
// atteint le total dû jusqu'à elle. Cela marche pour les trois façons de payer : à la séance, forfait payé
// d'avance (le reste du forfait apparaît comme une avance), en fin de mois (un règlement pour le mois).
import { isUpcoming } from './tutoring';
import { today } from './dates';
import { db, type Billing, type Group, type PayMode, type Payment, type TutoringSession } from './db';

export const PAY_MODES: { key: PayMode; label: string; hint: string }[] = [
  { key: 'seance', label: 'À la séance', hint: 'un règlement à chaque séance' },
  { key: 'forfait', label: 'Forfait payé d’avance', hint: 'ex. 10 h payées d’avance : le reste apparaît comme une avance' },
  { key: 'mois', label: 'En fin de mois', hint: 'un relevé et un règlement par mois' },
];
export const METHODS = ['Virement', 'Chèque', 'Espèces', 'CESU', 'Autre'];

// Devises proposées (chaque élève a la sienne, l'euro par défaut)
export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'CHF', label: 'Franc suisse (CHF)' },
  { code: 'GBP', label: 'Livre sterling (£)' },
  { code: 'USD', label: 'Dollar américain ($)' },
  { code: 'CAD', label: 'Dollar canadien ($ CA)' },
  { code: 'XPF', label: 'Franc pacifique (XPF)' },
  { code: 'MAD', label: 'Dirham marocain (MAD)' },
];
export const money = (n: number, currency = 'EUR') => n.toLocaleString('fr-FR', { style: 'currency', currency });
const round2 = (n: number) => Math.round(n * 100) / 100;

export const billingId = (teacherId: string, studentId: string) => `${teacherId}|${studentId}`;

// Tarif horaire en vigueur à une date (le plus récent dont la date d'effet est passée)
export function rateAt(b: Billing | undefined, date: string): number | undefined {
  const r = (b?.rates ?? []).filter((x) => x.from <= date).sort((x, y) => (x.from < y.from ? 1 : -1))[0];
  return r?.hourly;
}

export interface Line {
  session: TutoringSession;
  group?: Group;
  hours: number;
  rate?: number;
  amount: number;
  paid: boolean; // couverte par les règlements
  partly: boolean; // en partie seulement
}
export interface Ledger {
  lines: Line[]; // du plus ancien au plus récent
  payments: Payment[];
  due: number;
  paid: number;
  balance: number; // > 0 : avance ; < 0 : reste à payer
  missingRate: boolean;
  hours: number;
  currency: string;
  free: boolean; // tarif à 0 : soutien gratuit, rien à régler
}

export function buildLedger(studentId: string, sessions: TutoringSession[], billing: Billing | undefined, payments: Payment[], groups: Group[] = []): Ledger {
  // Seules les séances terminées sont dues (une séance préparée à l'avance n'est pas encore facturée)
  const mine = sessions
    .filter((s) => s.studentIds.includes(studentId) && !isUpcoming(s))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
  const paid = round2(payments.reduce((a, p) => a + p.amount, 0));
  let cum = 0;
  let missingRate = false;
  const lines = mine.map((s) => {
    const rate = rateAt(billing, s.date);
    if (rate === undefined) missingRate = true;
    const hours = s.duration / 60;
    const amount = round2(hours * (rate ?? 0));
    const before = cum;
    cum = round2(cum + amount);
    return { session: s, group: groups.find((g) => g.id === s.groupId), hours, rate, amount, paid: amount > 0 && paid >= cum, partly: amount > 0 && paid > before && paid < cum };
  });
  return {
    lines,
    payments: [...payments].sort((a, b) => a.date.localeCompare(b.date)),
    due: cum,
    paid,
    balance: round2(paid - cum),
    missingRate,
    hours: lines.reduce((a, l) => a + l.hours, 0),
    currency: billing?.currency || 'EUR',
    free: rateAt(billing, today()) === 0,
  };
}

// Toutes les données d'un élève (séances de ses groupes de soutien du professeur, tarif, règlements)
export async function loadLedger(teacherId: string, studentId: string) {
  const ms = await db.memberships.where('studentId').equals(studentId).toArray();
  const groups = ((await db.groups.bulkGet(ms.map((m) => m.groupId))).filter((g) => g && g.kind === 'soutien' && g.teacherIds.includes(teacherId)) as Group[]);
  const sessions = (await db.tutoringSessions.where('groupId').anyOf(groups.map((g) => g.id)).toArray());
  const billing = await db.billing.get(billingId(teacherId, studentId));
  const payments = (await db.payments.where('studentId').equals(studentId).toArray()).filter((p) => p.teacherId === teacherId);
  return { ledger: buildLedger(studentId, sessions, billing, payments, groups), billing, groups };
}

export const monthOf = (iso: string) => iso.slice(0, 7);
export const monthLabel = (m: string) =>
  new Date(m + '-15T12:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());

// Récapitulatif d'un mois pour un élève
export function monthSummary(l: Ledger, month: string) {
  const lines = l.lines.filter((x) => monthOf(x.session.date) === month);
  const pays = l.payments.filter((p) => monthOf(p.date) === month);
  const due = round2(lines.reduce((a, x) => a + x.amount, 0));
  const before = l.lines.filter((x) => monthOf(x.session.date) < month).reduce((a, x) => a + x.amount, 0) - l.payments.filter((p) => monthOf(p.date) < month).reduce((a, p) => a + p.amount, 0);
  return {
    lines,
    payments: pays,
    hours: lines.reduce((a, x) => a + x.hours, 0),
    due,
    received: round2(pays.reduce((a, p) => a + p.amount, 0)),
    previous: round2(-before), // > 0 : avance du mois précédent ; < 0 : reste dû
    unpaid: round2(lines.filter((x) => !x.paid).reduce((a, x) => a + x.amount, 0)),
  };
}

export const hoursLabel = (h: number) => {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`;
};
