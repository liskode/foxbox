// Appel et absences : un élève coché absent sur le plan de classe un jour donné.
import { db, type Absence } from './db';
import { unitLabel } from './units';

export const absenceId = (groupId: string, studentId: string, date: string) => `${groupId}|${studentId}|${date}`;

export async function toggleAbsence(teacherId: string, groupId: string, studentId: string, date: string) {
  const id = absenceId(groupId, studentId, date);
  if (await db.absences.get(id)) await db.absences.delete(id);
  else await db.absences.put({ id, teacherId, studentId, groupId, date, createdAt: Date.now() });
}

// Séance(s) faite(s) par la classe ce jour-là (d'après la Progression)
export async function seancesOn(groupId: string, date: string) {
  const pubs = (await db.publications.where('groupId').equals(groupId).toArray()).filter((p) => p.date === date);
  const units = (await db.units.bulkGet(pubs.map((p) => p.unitId))).filter(Boolean);
  return units.map((u) => unitLabel(u!)).join(' · ');
}

export async function absencesOf(studentId: string): Promise<(Absence & { seance: string })[]> {
  const list = (await db.absences.where('studentId').equals(studentId).toArray()).sort((a, b) => b.date.localeCompare(a.date));
  return Promise.all(list.map(async (a) => ({ ...a, seance: await seancesOn(a.groupId, a.date) })));
}
