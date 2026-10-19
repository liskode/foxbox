// Interlocuteurs de la famille (Mère, Père, Grand-mère…) et leur code, affiché dans un rond à côté de leurs messages.
// La liste se règle dans les Réglages ; elle est recopiée dans les groupes de soutien pour que l'élève et les parents la voient.
import { db, type Group } from './db';

export interface Relation {
  label: string;
  code: string; // 1 à 3 lettres
}
export const DEFAULT_RELATIONS: Relation[] = [
  { label: 'Mère', code: 'M' },
  { label: 'Père', code: 'P' },
  { label: 'Grand-mère', code: 'GM' },
  { label: 'Grand-père', code: 'GP' },
  { label: 'Sœur', code: 'S' },
  { label: 'Frère', code: 'F' },
  { label: 'Tante', code: 'T' },
  { label: 'Oncle', code: 'O' },
  { label: 'Tuteur', code: 'Tu' },
];

// « Père – Remy Tobler » → « P » (sinon les initiales du nom)
export function codeFor(name: string, relations: Relation[] = DEFAULT_RELATIONS) {
  const label = name.split(' – ')[0].trim().toLowerCase();
  const r = relations.find((x) => x.label.toLowerCase() === label);
  if (r) return r.code;
  return (
    name
      .split(/[\s–-]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

// Photo et interlocuteurs du professeur, recopiés dans ses groupes de soutien (lisibles par l'élève et les parents)
export async function shareTeacherProfile(teacherId: string) {
  const t = await db.teachers.get(teacherId);
  if (!t) return;
  const groups = (await db.groups.toArray()).filter((g) => g.kind === 'soutien' && g.teacherIds.includes(teacherId));
  for (const g of groups) {
    const patch: Partial<Group> = { teacherPhotoId: t.photoId, relations: t.relations ?? DEFAULT_RELATIONS };
    if (g.teacherPhotoId !== patch.teacherPhotoId || JSON.stringify(g.relations) !== JSON.stringify(patch.relations)) await db.groups.update(g.id, patch);
  }
}
