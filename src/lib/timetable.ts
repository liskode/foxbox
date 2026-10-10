// Emploi du temps du professeur : cours de la semaine A et de la semaine B (lus dans les PDF Pronote),
// calendrier de l'année (semaine A, B ou vacances) et jours fériés.
import { db, uid, type Group } from './db';
import { addDays, fromISO, toISO } from './dates';
import { openPdf, mul } from './trombiPdf';

export type WeekType = 'A' | 'B';

export interface Slot {
  id: string;
  week: 'A' | 'B' | 'AB'; // AB : toutes les semaines
  day: number; // 1 = lundi … 5 = vendredi (6 = samedi)
  start: string; // « 08:00 »
  end: string;
  subject: string; // PHYSIQUE-CHIMIE, DEVOIRS FAITS…
  label: string; // classe ou groupe tel qu'écrit dans Pronote : 3C, [6B1]…
  groupId?: string; // classe FoxBox correspondante
  room?: string;
  aide?: string; // accompagnant (AESH…)
  hp?: boolean; // hors progression (par défaut : Devoirs faits, parcours orientation)
}

export interface Timetable {
  school?: string;
  slots: Slot[];
  weeks: Record<string, WeekType>; // lundi (AAAA-MM-JJ) → A ou B ; semaine absente = vacances
  off: string[]; // jours fériés ou sans cours dans une semaine de classe
  presentDays?: number[]; // jours où je suis dans l'établissement (tous si vide)
}

export const DAYS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const EMPTY: Timetable = { slots: [], weeks: {}, off: [] };

export const mondayOf = (iso: string) => {
  const d = fromISO(iso).getDay(); // 0 = dimanche
  return addDays(iso, d === 0 ? -6 : 1 - d);
};
export const dayOf = (iso: string) => fromISO(iso).getDay(); // 1 = lundi
export const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const shortTime = (t: string) => t.replace(/^0/, '').replace(':', 'h');

// Semaine A, B, ou null (vacances / hors année scolaire)
export const weekType = (tt: Timetable, iso: string): WeekType | null => tt.weeks[mondayOf(iso)] ?? null;

// Cours d'une journée donnée, triés par heure
export function slotsOn(tt: Timetable, iso: string): Slot[] {
  const w = weekType(tt, iso);
  if (!w || tt.off.includes(iso)) return [];
  const d = dayOf(iso);
  return tt.slots.filter((s) => s.day === d && (s.week === 'AB' || s.week === w)).sort((a, b) => a.start.localeCompare(b.start));
}

// Le cours fait-il avancer la progression de la classe ?
export const countsForProgress = (s: Slot) => !(s.hp ?? /devoirs faits|orientation/i.test(s.subject));

export const isPresent = (tt: Timetable, day: number) => !tt.presentDays?.length || tt.presentDays.includes(day);

// Prochain jour (à partir de iso inclus) où j'ai cours et suis présent
export function nextTeachingDay(tt: Timetable, iso: string, maxDays = 120): string | null {
  for (let i = 0; i < maxDays; i++) {
    const d = addDays(iso, i);
    if (isPresent(tt, dayOf(d)) && slotsOn(tt, d).length) return d;
  }
  return null;
}

// Premier jour de reprise après des vacances
export function nextSchoolWeek(tt: Timetable, iso: string): string | null {
  const keys = Object.keys(tt.weeks).sort();
  return keys.find((k) => k > iso) ?? null;
}

// Classe FoxBox correspondant à une étiquette Pronote : « 3C », « [6B1] » (demi-groupe), « [3APH-CH] »
export function matchGroup(label: string, groups: Group[]): Group | undefined {
  const m = label.replace(/[[\]]/g, '').toUpperCase().match(/^(\d[A-Z])/);
  if (!m) return undefined;
  return groups.find((g) => {
    const n = g.name.toUpperCase().replace(/\s+/g, '');
    return n.startsWith(m[1]) && !/[A-Z0-9]/.test(n[m[1].length] ?? '');
  });
}

export async function loadTimetable(teacherId: string): Promise<Timetable> {
  const t = await db.teachers.get(teacherId);
  return { ...EMPTY, ...(t?.timetable ?? {}) };
}
export async function saveTimetable(teacherId: string, tt: Timetable) {
  await db.teachers.update(teacherId, { timetable: tt });
}

// ---------- Lecture d'un PDF « Emploi du temps » exporté de Pronote ----------

export interface PronoteWeek {
  fileName: string;
  school?: string;
  week?: WeekType; // « Semaine SA » / « Semaine SB »
  monday?: string;
  slots: Slot[];
}

interface TextItem {
  x: number;
  y: number;
  s: string;
}

const MONTHS: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
};
const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export async function readPronotePdf(file: File, groups: Group[]): Promise<PronoteWeek> {
  const { pdfjs, pdf } = await openPdf(file);
  const page = await pdf.getPage(1);
  const OPS = pdfjs.OPS;

  // 1. Textes (position en points PDF)
  const tc = await page.getTextContent();
  const texts: TextItem[] = [];
  for (const it of tc.items) {
    if (!('str' in it)) continue;
    const s = it.str.replace(/[-]/g, '').trim(); // pictogrammes Pronote
    if (s) texts.push({ x: it.transform[4], y: it.transform[5], s });
  }
  const all = texts.map((t) => t.s).join(' ');
  const week = all.match(/Semaine\s+S?([AB])\b/i)?.[1]?.toUpperCase() as WeekType | undefined;
  const school = texts.find((t) => /coll[eè]ge|lyc[ée]e/i.test(t.s))?.s.replace(/^(COLLEGE|LYCEE)\s+/, '');
  const yearOf = (month: number) => {
    const m = all.match(/du \d{1,2}(?: \S+)? au \d{1,2} (\S+) (\d{4})/);
    const y = m ? +m[2] : new Date().getFullYear();
    const endMonth = m ? MONTHS[m[1].toLowerCase()] ?? month : month;
    return month > endMonth ? y - 1 : y; // semaine à cheval sur deux années
  };

  // En-têtes des jours : « lundi 05/10 »
  const heads: { day: number; x: number; date: string }[] = [];
  for (const t of texts) {
    const m = t.s.match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi)\s+(\d{2})\/(\d{2})/i);
    if (m) heads.push({ day: DAY_NAMES.indexOf(m[1].toLowerCase()) + 1, x: t.x, date: toISO(new Date(yearOf(+m[3]), +m[3] - 1, +m[2])) });
  }
  if (!heads.length) throw new Error(`« ${file.name} » ne ressemble pas à un emploi du temps Pronote (jours introuvables).`);
  heads.sort((a, b) => a.x - b.x);
  const headY = Math.min(...texts.filter((t) => /^(lundi|mardi|mercredi|jeudi|vendredi|samedi)\s/i.test(t.s)).map((t) => t.y));
  const monday = mondayOf(heads[0].date);

  // Heures en marge : « 8h00 », « 8h55 »… Une limite entre deux lignes porte l'heure de fin (au-dessus)
  // et l'heure de début (en dessous) ; une heure seule sert aux deux.
  const labels = texts
    .filter((t) => /^\d{1,2}h\d{2}$/.test(t.s) && t.x < heads[0].x)
    .map((t) => ({ y: t.y, min: +t.s.split('h')[0] * 60 + +t.s.split('h')[1] }))
    .sort((a, b) => b.y - a.y);
  if (labels.length < 2) throw new Error(`« ${file.name} » : heures introuvables.`);
  const bounds: { y: number; start: number; end: number }[] = [];
  for (let i = 0; i < labels.length; i++) {
    const a = labels[i];
    const b = labels[i + 1];
    if (b && a.y - b.y < 14) {
      bounds.push({ y: (a.y + b.y) / 2 + 2, end: a.min, start: b.min });
      i++;
    } else bounds.push({ y: a.y + (i === 0 ? 7 : bounds.length && i === labels.length - 1 ? -3 : 7), start: a.min, end: a.min });
  }
  const timeAt = (y: number, edge: 'start' | 'end') => {
    let best = bounds[0];
    for (const b of bounds) if (Math.abs(b.y - y) < Math.abs(best.y - y)) best = b;
    if (Math.abs(best.y - y) < 10) return edge === 'start' ? best.start : best.end;
    // Bord au milieu d'une ligne (demi-heure) : interpolation, arrondie à 5 min
    const above = [...bounds].reverse().find((b) => b.y > y) ?? bounds[0];
    const below = bounds.find((b) => b.y < y) ?? bounds[bounds.length - 1];
    const t = above.start + ((above.y - y) / Math.max(1, above.y - below.y)) * (below.end - above.start);
    return Math.round(t / 5) * 5;
  };

  // 2. Cases des cours : rectangles colorés (non blancs) sous les en-têtes
  const ops = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  let fill = [0, 0, 0];
  const boxes: { x0: number; x1: number; top: number; bottom: number }[] = [];
  ops.fnArray.forEach((fn, i) => {
    const args = ops.argsArray[i] as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args as number[]);
    else if (fn === OPS.setFillRGBColor) fill = Array.from(args as unknown as ArrayLike<number>).slice(0, 3);
    else if (fn === OPS.constructPath) {
      const [kinds, coords] = args as [number[], number[]];
      if (kinds.length !== 1 || kinds[0] !== OPS.rectangle) return;
      if (fill.every((c) => c >= 250)) return; // fond blanc
      const [x, y, w, h] = coords;
      const p = (px: number, py: number) => [ctm[0] * px + ctm[2] * py + ctm[4], ctm[1] * px + ctm[3] * py + ctm[5]];
      const [ax, ay] = p(x, y);
      const [bx, by] = p(x + w, y + h);
      const box = { x0: Math.min(ax, bx), x1: Math.max(ax, bx), top: Math.max(ay, by), bottom: Math.min(ay, by) };
      if (box.x1 - box.x0 < 40 || box.top - box.bottom < 15 || box.top > headY) return;
      boxes.push(box);
    }
  });

  // 3. Contenu de chaque case
  const dayAt = (x: number) => {
    let d = heads[0];
    for (let i = 1; i < heads.length; i++) if (x > (heads[i - 1].x + heads[i].x) / 2) d = heads[i];
    return d;
  };
  const slots: Slot[] = [];
  for (const b of boxes) {
    const inside = texts
      .filter((t) => t.x >= b.x0 - 2 && t.x <= b.x1 && t.y <= b.top && t.y >= b.bottom - 2)
      .sort((p, q) => q.y - p.y || p.x - q.x);
    if (!inside.length) continue;
    let label = '';
    let room: string | undefined;
    let aide: string | undefined;
    const rest: string[] = [];
    for (const t of inside) {
      if (/\(acc\.\)/.test(t.s)) aide = t.s.replace(/\s*\(acc\.\)/, '');
      else if (!label && /^(\[[^\]]+\]|\d[A-Z][A-Z0-9]?)$/.test(t.s)) label = t.s;
      else if (!room && /^[A-Z]{1,4}\s?\d{1,4}[A-Z]?$/.test(t.s)) room = t.s;
      else rest.push(t.s);
    }
    const h = dayAt((b.x0 + b.x1) / 2);
    const start = timeAt(b.top, 'start');
    const end = timeAt(b.bottom, 'end');
    slots.push({
      id: uid(),
      week: week ?? 'AB',
      day: h.day,
      start: hm(start),
      end: hm(Math.max(end, start + 15)),
      subject: rest.join(' ') || '—',
      label,
      groupId: matchGroup(label, groups)?.id,
      room,
      aide,
    });
  }
  slots.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  return { fileName: file.name, school, week, monday, slots };
}

// Réunit une semaine A et une semaine B : un cours identique les deux semaines devient « toutes les semaines »
export function mergeWeeks(parsed: PronoteWeek[]): Slot[] {
  const key = (s: Slot) => [s.day, s.start, s.end, s.subject, s.label, s.room ?? ''].join('|');
  const a = parsed.filter((p) => p.week === 'A').flatMap((p) => p.slots);
  const b = parsed.filter((p) => p.week === 'B').flatMap((p) => p.slots);
  const other = parsed.filter((p) => !p.week).flatMap((p) => p.slots);
  const bKeys = new Map(b.map((s) => [key(s), s]));
  const out: Slot[] = [...other];
  for (const s of a) {
    const twin = bKeys.get(key(s));
    if (twin) {
      out.push({ ...s, week: 'AB', aide: s.aide ?? twin.aide });
      bKeys.delete(key(s));
    } else out.push(s);
  }
  out.push(...bKeys.values());
  return out.sort((x, y) => x.day - y.day || x.start.localeCompare(y.start) || x.week.localeCompare(y.week));
}

// À partir d'une semaine connue, alternance A/B en sautant les vacances (semaines non cochées)
export function realternate(tt: Timetable, from: string): Record<string, WeekType> {
  const weeks = { ...tt.weeks };
  const keys = Object.keys(weeks).sort().filter((k) => k >= from);
  let w = weeks[from];
  for (const k of keys.slice(1)) {
    w = w === 'A' ? 'B' : 'A';
    weeks[k] = w;
  }
  return weeks;
}

// ---------- Calendrier 2026-2027, Collège J. & M. Audin (Vitry-sur-Seine, académie de Créteil) ----------
// Relevé sur le calendrier Pronote : lundi de chaque semaine de classe → A/B ; les semaines absentes sont des vacances.
const AUDIN_WEEKS =
  '2026-08-31A 09-07B 09-14A 09-21B 09-28A 10-05B 10-12A 11-02B 11-09A 11-16B 11-23A 11-30B 12-07A 12-14B ' +
  '2027-01-04A 01-11B 01-18A 01-25B 02-01A 02-22B 03-01A 03-08B 03-15A 03-22B 03-29A 04-19B 04-26A ' +
  '05-03B 05-10A 05-17B 05-24A 05-31B 06-07A 06-14B 06-21A 06-28B';
export const AUDIN_2026: Pick<Timetable, 'weeks' | 'off'> = (() => {
  const weeks: Record<string, WeekType> = {};
  let year = '';
  for (const w of AUDIN_WEEKS.split(' ')) {
    const m = w.match(/^(?:(\d{4})-)?(\d{2}-\d{2})([AB])$/)!;
    if (m[1]) year = m[1];
    weeks[`${year}-${m[2]}`] = m[3] as WeekType;
  }
  // Jours sans cours dans une semaine de classe : lundi avant la rentrée, 11 novembre, lundi de Pâques, pont de l'Ascension, lundi de Pentecôte
  return { weeks, off: ['2026-08-31', '2026-11-11', '2027-03-29', '2027-05-06', '2027-05-07', '2027-05-17'] };
})();
