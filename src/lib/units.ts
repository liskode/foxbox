// Séquences et séances : codes par niveau et libellés.
import { db, type Unit } from './db';

export const LEVELS = ['6e', '5e', '4e', '3e'];

export const unitLabel = (u: Pick<Unit, 'code' | 'name'>) => (u.code ? `${u.code} · ${u.name}` : u.name);

// Prochain code de séquence pour un niveau : 41, 42… (4e)
export async function nextSequenceCode(level?: string) {
  if (!level) return undefined;
  const seqs = (await db.units.toArray()).filter((u) => u.kind === 'sequence' && u.level === level);
  const n = Math.max(0, ...seqs.map((u) => parseInt(u.code?.slice(1) ?? '0') || 0));
  return `${level[0]}${n + 1}`;
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
