// Séquences et séances : codes par niveau et libellés.
import { db, SUBJECTS, type Unit } from './db';

export const LEVELS = ['6e', '5e', '4e', '3e'];
// Niveaux du lycée (soutien scolaire)
export const LYCEE = ['2nde', '1re', 'Tle'];
export const ALL_LEVELS = [...LEVELS, ...LYCEE];
export const byLevel = (a: string, b: string) => ALL_LEVELS.indexOf(a) - ALL_LEVELS.indexOf(b);

// Thèmes du programme de cycle 4 (5e, 4e, 3e)
export const THEME_NAMES: Record<string, string> = {
  '1': 'Organisation et transformations de la matière',
  '2': 'Mouvement et interactions',
  '3': "L'énergie et ses conversions",
  '4': 'Des signaux pour observer et communiquer',
};
// Thèmes du cycle 3 (6e, sciences et technologie)
export const THEME_NAMES_C3: Record<string, string> = {
  '1': 'Matière, mouvement, énergie, information',
  '2': 'Le vivant, sa diversité et les fonctions qui le caractérisent',
  '3': 'La Terre, une planète peuplée par des êtres vivants',
};
// Thèmes du lycée (physique-chimie, de la 2nde à la Terminale)
export const THEME_NAMES_LYCEE: Record<string, string> = {
  '1': 'Constitution et transformations de la matière',
  '2': 'Mouvement et interactions',
  '3': "L'énergie : conversions et transferts",
  '4': 'Ondes et signaux',
};
// Mathématiques : mêmes grands thèmes du collège au lycée (le chiffre correspond au thème des flashcards)
export const THEME_NAMES_MATHS: Record<string, string> = {
  '1': 'Nombres et calculs',
  '2': 'Fonctions',
  '3': 'Données, statistiques et probabilités',
  '4': 'Grandeurs, mesures et géométrie',
  '5': 'Algorithmique et programmation',
};
export const HORS_THEME = 'Hors thème (présentation, révisions)';
export const themesFor = (level?: string, subject?: string): Record<string, string> => ({
  ...(subject === 'Mathématiques' ? THEME_NAMES_MATHS : level === '6e' ? THEME_NAMES_C3 : LYCEE.includes(level ?? '') ? THEME_NAMES_LYCEE : THEME_NAMES),
  '0': HORS_THEME,
});
export const themeLabel = (t?: string, level?: string, subject?: string) =>
  t === '0' ? HORS_THEME : t ? `Thème ${t} – ${themesFor(level, subject)[t] ?? ''}` : 'Sans thème';

export const unitSubject = (u: Pick<Unit, 'subject'>) => u.subject || SUBJECTS[0];
export const unitLabel = (u: Pick<Unit, 'code' | 'name'>) => (u.code ? `${u.code} · ${u.name}` : u.name);

// Prochain code de séquence pour un niveau et un thème : 411, 412… (4e, thème 1) — 9 séquences par thème au plus
export async function nextSequenceCode(level?: string, theme?: string, subject = SUBJECTS[0]) {
  if (!level || !theme) return undefined;
  const seqs = (await db.units.toArray()).filter((u) => u.kind === 'sequence' && u.level === level && u.theme === theme && u.subject === subject);
  const n = Math.max(0, ...seqs.map((u) => parseInt(u.code?.slice(2) ?? '0') || 0));
  if (n >= 9) throw new Error(`Déjà 9 séquences dans le thème ${theme} en ${level}.`);
  return `${level[0]}${theme}${n + 1}`;
}

// Prochain code de séance dans une séquence : 411, 412…
export async function nextSeanceCode(parent: Unit) {
  if (!parent.code) return undefined;
  const kids = await db.units.where('parentId').equals(parent.id).toArray();
  const n = Math.max(0, ...kids.map((u) => (u.code?.startsWith(parent.code!) ? parseInt(u.code.slice(parent.code!.length)) || 0 : 0)));
  return `${parent.code}${n + 1}`;
}

// ----- Couleur par niveau : toutes les classes d'un niveau partagent la même couleur -----
export const DEFAULT_LEVEL_COLORS: Record<string, string> = {
  '6e': '#dcedcf', // Pistache
  '5e': '#fbe7b0', // Moutarde
  '4e': '#d3eaf5', // Ciel
  '3e': '#f9d3cd', // Saumon
};

// Niveau déduit du nom de la classe (« 4A_2627 » → 4e)
export const levelOfName = (name: string) => {
  const m = name.match(/^\s*(\d)/);
  return m ? `${m[1]}e` : undefined;
};

export async function levelColors(teacherId: string) {
  const t = await db.teachers.get(teacherId);
  return { ...DEFAULT_LEVEL_COLORS, ...(t?.levelColors ?? {}) };
}

// Applique la couleur de leur niveau à toutes les classes (sans toucher à celles dont le niveau est inconnu)
export async function applyLevelColors(teacherId: string) {
  const map = await levelColors(teacherId);
  for (const g of await db.groups.toArray()) {
    if (g.kind === 'soutien') continue;
    const lvl = levelOfName(g.name);
    if (lvl && map[lvl] && g.color !== map[lvl]) await db.groups.update(g.id, { color: map[lvl] });
  }
}

export async function setLevelColor(teacherId: string, level: string, color: string) {
  const t = await db.teachers.get(teacherId);
  if (t) await db.teachers.update(teacherId, { levelColors: { ...(t.levelColors ?? {}), [level]: color } });
  await applyLevelColors(teacherId);
}

// ----- Ordre de la progression : les séquences d'un niveau sont rangées dans l'ordre où elles sont faites
// (champ order), les thèmes pouvant alterner ; le code (niveau + thème + n) suit cet ordre à l'intérieur d'un thème.
export const byProgression = (a: Unit, b: Unit) => a.order - b.order || (a.code ?? '').localeCompare(b.code ?? '', 'fr', { numeric: true });

async function siblingsOf(u: Unit) {
  const all = await db.units.toArray();
  const sib =
    u.kind === 'sequence'
      ? all.filter((x) => x.kind === 'sequence' && x.level === u.level && x.subject === u.subject)
      : all.filter((x) => x.kind === 'seance' && x.parentId === u.parentId);
  return sib.sort(byProgression);
}

async function renumberSeances(seq: Unit) {
  const kids = (await db.units.where('parentId').equals(seq.id).toArray()).sort((a, b) => a.order - b.order);
  for (const [i, k] of kids.entries()) {
    const code = seq.code ? `${seq.code}${i + 1}` : k.code;
    if (k.order !== i + 1 || k.code !== code) await db.units.update(k.id, { order: i + 1, code });
  }
}

// Renumérote un niveau : order = rang dans la progression, code = niveau + thème + rang dans le thème
export async function renumberLevel(seqs: Unit[]) {
  const perTheme = new Map<string, number>();
  for (const [k, x] of seqs.entries()) {
    const t = x.theme ?? '0';
    const n = (perTheme.get(t) ?? 0) + 1;
    perTheme.set(t, n);
    const code = x.level ? `${x.level[0]}${t}${n}` : x.code;
    if (x.order !== k + 1 || x.code !== code) {
      await db.units.update(x.id, { order: k + 1, code });
      await renumberSeances({ ...x, code });
    }
  }
}

export async function moveUnit(u: Unit, delta: -1 | 1) {
  const sib = await siblingsOf(u);
  const i = sib.findIndex((x) => x.id === u.id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= sib.length) return;
  [sib[i], sib[j]] = [sib[j], sib[i]];
  if (u.kind === 'sequence') return renumberLevel(sib);
  const parent = await db.units.get(u.parentId!);
  for (const [k, x] of sib.entries()) {
    const code = parent?.code ? `${parent.code}${k + 1}` : x.code;
    if (x.order !== k + 1 || x.code !== code) await db.units.update(x.id, { order: k + 1, code });
  }
}

export async function canMove(u: Unit) {
  const sib = await siblingsOf(u);
  const i = sib.findIndex((x) => x.id === u.id);
  return { up: i > 0, down: i >= 0 && i < sib.length - 1 };
}
