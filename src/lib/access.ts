// Co-enseignement : qui peut modifier quoi. Reprend exactement les règles du serveur
// (migration 20261118000000_co_enseignement.sql) pour masquer ce qui serait refusé.
// - Le premier professeur d'une classe en est le propriétaire ; il choisit ses co-enseignants
//   et leur droit : lecture seule, ou modification (Group.editorIds).
// - Une séquence (et ses séances, ses flashcards) est modifiable par son auteur, par les collègues avec qui
//   elle est partagée en modification (Unit.editorIds), et par les co-enseignants autorisés à modifier
//   une classe du même niveau et de la même matière.
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Card, type Evaluation, type Group, type Unit, type UnitCard } from './db';
import { levelOfName, unitSubject } from './units';
import { useAuth } from './auth';

export const ownerOf = (g: Group) => g.teacherIds[0];
export const isOwner = (g: Group | undefined, me: string) => !!g && g.teacherIds[0] === me;
// Droit d'un collègue sur une classe : absent, lecture ou modification
export type Right = 'aucun' | 'lecture' | 'modification';
export const rightOf = (g: Group, teacherId: string): Right =>
  g.teacherIds[0] === teacherId || (g.teacherIds.includes(teacherId) && g.editorIds?.includes(teacherId))
    ? 'modification'
    : g.teacherIds.includes(teacherId)
      ? 'lecture'
      : 'aucun';

export const canEditGroup = (g: Group | undefined, me: string) => !!g && rightOf(g, me) === 'modification';

export function canEditUnit(u: Unit | undefined, me: string, units: Unit[], groups: Group[]) {
  if (!u) return false;
  if (!u.ownerId || u.ownerId === me) return true;
  const seq = u.kind === 'sequence' || !u.parentId ? u : units.find((x) => x.id === u.parentId);
  if (!seq) return false;
  if (seq.editorIds?.includes(me)) return true;
  return groups.some(
    (g) =>
      g.kind !== 'soutien' &&
      g.teacherIds.includes(me) &&
      !!g.editorIds?.includes(me) &&
      levelOfName(g.name) === seq.level &&
      (g.subject || 'Physique-Chimie') === unitSubject(seq),
  );
}

export const canEditEval = (ev: Evaluation | undefined, me: string, groups: Group[]) =>
  !!ev && (!ev.ownerId || ev.ownerId === me || ev.groupIds.some((id) => canEditGroup(groups.find((g) => g.id === id), me)));

export const canEditCard = (c: Card | undefined, me: string, links: UnitCard[], units: Unit[], groups: Group[]) =>
  !!c && (!c.ownerId || c.ownerId === me || links.some((l) => l.cardId === c.id && canEditUnit(units.find((u) => u.id === l.unitId), me, units, groups)));

// Nom du propriétaire d'une classe, d'une séquence ou d'une évaluation (pour le bandeau « lecture seule »)
export function useTeacherName(id: string | undefined) {
  return useLiveQuery(async () => (id ? (await db.teachers.get(id))?.name : undefined), [id]);
}

// Droits de l'utilisateur connecté, recalculés quand les classes ou les séquences changent
export function useAccess() {
  const { session } = useAuth();
  const me = session?.id ?? '';
  const groups = useLiveQuery(() => db.groups.toArray(), [], [] as Group[]);
  const units = useLiveQuery(() => db.units.toArray(), [], [] as Unit[]);
  return {
    me,
    groups,
    units,
    canEditGroup: (g: Group | undefined) => canEditGroup(g, me),
    canEditUnit: (u: Unit | undefined) => canEditUnit(u, me, units, groups),
    canEditEval: (ev: Evaluation | undefined) => canEditEval(ev, me, groups),
    isOwner: (g: Group | undefined) => isOwner(g, me),
  };
}
