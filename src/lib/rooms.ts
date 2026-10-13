// Salles et plans de classe. Une salle est un quadrillage dont les cases cochées sont des places ;
// des places voisines forment une table, une case vide sépare les tables. Le tableau est en haut.
import { db, uid, type Group, type Student } from './db';
import { loadTimetable, matchGroup } from './timetable';

export interface Room {
  id: string;
  name: string; // SC102…
  rows: number;
  cols: number;
  seats: string[]; // « ligne-colonne » des cases cochées
}

export interface SeatPlan {
  id: string;
  name: string; // Plan, TP, demi-groupe 1…
  roomId: string;
  seats: Record<string, string>; // place → élève
  subgroupId?: string; // plan d'un sous-groupe (demi-groupe…) : seuls ses élèves sont proposés
}

export const seatKey = (r: number, c: number) => `${r}-${c}`;

export async function loadRooms(teacherId: string): Promise<Room[]> {
  return (await db.teachers.get(teacherId))?.rooms ?? [];
}
export async function saveRooms(teacherId: string, rooms: Room[]) {
  await db.teachers.update(teacherId, { rooms });
}
export const newRoom = (name: string): Room => ({ id: uid(), name, rows: 8, cols: 10, seats: [] });

// Salles citées dans l'emploi du temps, et salle habituelle d'une classe
export async function timetableRooms(teacherId: string, group?: Group, groups: Group[] = []) {
  const tt = await loadTimetable(teacherId);
  const all = [...new Set(tt.slots.map((s) => s.room).filter(Boolean) as string[])];
  const mine = group
    ? tt.slots.filter((s) => s.room && (s.groupId === group.id || matchGroup(s.label, groups)?.id === group.id)).map((s) => s.room!)
    : [];
  const usual = mine.sort((a, b) => mine.filter((x) => x === b).length - mine.filter((x) => x === a).length)[0];
  return { all, usual };
}

export async function savePlans(group: Group, plans: SeatPlan[]) {
  await db.groups.update(group.id, { seatPlans: plans });
}

const shuffle = <T,>(a: T[]) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

// Places dans l'ordre de lecture (du tableau vers le fond, de gauche à droite)
export const orderedSeats = (room: Room) =>
  [...room.seats].sort((a, b) => {
    const [ra, ca] = a.split('-').map(Number);
    const [rb, cb] = b.split('-').map(Number);
    return ra - rb || ca - cb;
  });

export function autoPlace(room: Room, students: Student[], mode: 'alpha' | 'random'): Record<string, string> {
  const list = mode === 'random' ? shuffle(students) : [...students].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const seats = orderedSeats(room);
  const out: Record<string, string> = {};
  list.slice(0, seats.length).forEach((s, i) => (out[seats[i]] = s.id));
  return out;
}
