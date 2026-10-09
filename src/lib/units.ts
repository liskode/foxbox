// Séquences et séances : codes par niveau et libellés.
import { db, type Unit } from './db';

export const LEVELS = ['6e', '5e', '4e', '3e'];

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
export const themesFor = (level?: string) => (level === '6e' ? THEME_NAMES_C3 : THEME_NAMES);
export const themeLabel = (t?: string, level?: string) => (t ? `Thème ${t} – ${themesFor(level)[t] ?? ''}` : 'Sans thème');

export const unitLabel = (u: Pick<Unit, 'code' | 'name'>) => (u.code ? `${u.code} · ${u.name}` : u.name);

// Prochain code de séquence pour un niveau et un thème : 411, 412… (4e, thème 1) — 9 séquences par thème au plus
export async function nextSequenceCode(level?: string, theme?: string) {
  if (!level || !theme) return undefined;
  const seqs = (await db.units.toArray()).filter((u) => u.kind === 'sequence' && u.level === level && u.theme === theme);
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
    const lvl = levelOfName(g.name);
    if (lvl && map[lvl] && g.color !== map[lvl]) await db.groups.update(g.id, { color: map[lvl] });
  }
}

export async function setLevelColor(teacherId: string, level: string, color: string) {
  const t = await db.teachers.get(teacherId);
  if (t) await db.teachers.update(teacherId, { levelColors: { ...(t.levelColors ?? {}), [level]: color } });
  await applyLevelColors(teacherId);
}

// ----- Réordonner : déplace une séquence (dans son niveau et son thème) ou une séance (dans sa séquence),
// puis renumérote les codes pour qu'ils suivent l'ordre (411, 412… ; 4111, 4112…)
async function siblingsOf(u: Unit) {
  const all = await db.units.toArray();
  const sib =
    u.kind === 'sequence'
      ? all.filter((x) => x.kind === 'sequence' && x.level === u.level && x.theme === u.theme && x.subject === u.subject)
      : all.filter((x) => x.kind === 'seance' && x.parentId === u.parentId);
  return sib.sort((a, b) => a.order - b.order || (a.code ?? '').localeCompare(b.code ?? '', 'fr', { numeric: true }));
}

async function renumberSeances(seq: Unit) {
  const kids = (await db.units.where('parentId').equals(seq.id).toArray()).sort((a, b) => a.order - b.order);
  for (const [i, k] of kids.entries()) {
    const code = seq.code ? `${seq.code}${i + 1}` : k.code;
    if (k.order !== i + 1 || k.code !== code) await db.units.update(k.id, { order: i + 1, code });
  }
}

export async function moveUnit(u: Unit, delta: -1 | 1) {
  const sib = await siblingsOf(u);
  const i = sib.findIndex((x) => x.id === u.id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= sib.length) return;
  [sib[i], sib[j]] = [sib[j], sib[i]];
  for (const [k, x] of sib.entries()) {
    if (x.kind === 'sequence') {
      const code = x.level && x.theme ? `${x.level[0]}${x.theme}${k + 1}` : x.code;
      if (x.order !== k + 1 || x.code !== code) {
        await db.units.update(x.id, { order: k + 1, code });
        await renumberSeances({ ...x, code });
      }
    } else {
      const parent = await db.units.get(x.parentId!);
      const code = parent?.code ? `${parent.code}${k + 1}` : x.code;
      if (x.order !== k + 1 || x.code !== code) await db.units.update(x.id, { order: k + 1, code });
    }
  }
}

export async function canMove(u: Unit) {
  const sib = await siblingsOf(u);
  const i = sib.findIndex((x) => x.id === u.id);
  return { up: i > 0, down: i >= 0 && i < sib.length - 1 };
}
