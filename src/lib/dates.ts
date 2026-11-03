import { inZone } from './time';

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISO(new Date());
}

// Jour de révision des flashcards : il change à 3 h du matin (les élèves se couchent parfois tard),
// dans le fuseau de l'élève (celui de l'appareil si aucun n'est fixé)
export const DAY_START_HOUR = 3;
export function studyDay(zone?: string, ts = Date.now()): string {
  const t = ts - DAY_START_HOUR * 3600000;
  return zone ? inZone(t, zone).date : toISO(new Date(t));
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86400000);
}

export function frDate(iso: string): string {
  return fromISO(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
