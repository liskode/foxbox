// Rendez-vous parents-professeurs : le professeur ouvre des plages (un ou plusieurs jours) découpées en créneaux
// de même durée ; les parents des classes concernées réservent un créneau libre par enfant, le changent ou l'annulent.
// En ligne, la réservation passe par le serveur (book_meeting_slot) : il vérifie et réserve en une fois, si bien que
// deux familles ne peuvent pas obtenir le même créneau ; un parent voit qu'un créneau est pris, jamais par qui.
import { db, type Meeting, type MeetingBooking } from './db';
import { ONLINE, supabase } from './supabase';
import { syncNow } from './sync';
import { today } from './dates';

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const slotTime = (slot: string) => slot.slice(11, 16).replace(':', ' h ');
export const slotEnd = (slot: string, duration: number) => toTime(toMin(slot.slice(11, 16)) + duration).replace(':', ' h ');

// Créneaux de la rencontre, jour par jour : « AAAA-MM-JJTHH:MM »
export function slotsByDay(m: Pick<Meeting, 'ranges' | 'duration'>) {
  const days = new Map<string, string[]>();
  const d = Math.max(5, m.duration || 10);
  for (const r of [...m.ranges].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))) {
    if (!r.date || !r.start || !r.end) continue;
    const list = days.get(r.date) ?? [];
    for (let t = toMin(r.start); t + d <= toMin(r.end); t += d) list.push(`${r.date}T${toTime(t)}`);
    days.set(r.date, list);
  }
  return [...days.entries()].map(([date, slots]) => ({ date, slots }));
}

export const nowSlot = () => {
  const d = new Date();
  return `${today()}T${toTime(d.getHours() * 60 + d.getMinutes())}`;
};
export const isClosed = (m: Meeting) => !!m.closesOn && today() > m.closesOn;

// Créneaux déjà pris (sans les noms, pour les parents)
export async function takenSlots(meetingId: string): Promise<Set<string>> {
  if (ONLINE) {
    const { data, error } = await supabase.rpc('meeting_taken_slots', { p_meeting: meetingId });
    if (!error && data) return new Set((data as string[]).map(String));
  }
  return new Set((await db.meetingBookings.where('meetingId').equals(meetingId).toArray()).map((b) => b.slot));
}

const MESSAGES: Record<string, string> = {
  pris: 'Ce créneau vient d’être pris par une autre famille. Choisissez-en un autre.',
  ferme: 'Les réservations sont closes.',
  passe: 'Ce créneau est déjà passé.',
  creneau: 'Ce créneau n’existe plus (les horaires ont changé).',
  interdit: 'Réservation impossible pour cet élève.',
  introuvable: 'Cette rencontre a été supprimée.',
  demo: 'Démo en lecture seule : la réservation n’est pas enregistrée.',
};

// Réservation ou changement de créneau par un parent ; renvoie un message d'erreur, ou null si c'est fait
export async function bookSlot(m: Meeting, studentId: string, slot: string, parent: { id: string; name: string }): Promise<string | null> {
  if (ONLINE) {
    const { data, error } = await supabase.rpc('book_meeting_slot', { p_meeting: m.id, p_student: studentId, p_slot: slot });
    if (error) return 'Réservation impossible (vérifiez la connexion).';
    if (data !== 'ok') return MESSAGES[String(data)] ?? 'Réservation impossible.';
    await syncNow();
    return null;
  }
  // Hors ligne (démo locale) : mêmes vérifications sur la copie locale
  if (isClosed(m)) return MESSAGES.ferme;
  if (slot < nowSlot()) return MESSAGES.passe;
  const id = `${m.id}|${studentId}`;
  const other = (await db.meetingBookings.where('meetingId').equals(m.id).toArray()).find((b) => b.slot === slot && b.id !== id);
  if (other) return MESSAGES.pris;
  const st = await db.students.get(studentId);
  await db.meetingBookings.put({
    id,
    meetingId: m.id,
    teacherId: m.teacherId,
    studentId,
    slot,
    parentId: parent.id,
    parentName: parent.name,
    studentName: `${st?.firstName ?? ''} ${st?.lastName ?? ''}`.trim(),
    bookedBy: 'parent',
    createdAt: Date.now(),
  });
  return null;
}

export async function cancelSlot(m: Meeting, studentId: string): Promise<string | null> {
  if (ONLINE) {
    const { data, error } = await supabase.rpc('cancel_meeting_slot', { p_meeting: m.id, p_student: studentId });
    if (error || data !== 'ok') return MESSAGES[String(data)] ?? 'Annulation impossible (vérifiez la connexion).';
    await syncNow(); // la ligne supprimée en ligne disparaît de la copie locale à la synchronisation
    return null;
  }
  await db.meetingBookings.delete(`${m.id}|${studentId}`);
  return null;
}

// Le professeur inscrit lui-même une famille (rendez-vous pris par téléphone…)
export async function teacherBook(m: Meeting, studentId: string, slot: string) {
  const st = await db.students.get(studentId);
  const b: MeetingBooking = {
    id: `${m.id}|${studentId}`,
    meetingId: m.id,
    teacherId: m.teacherId,
    studentId,
    slot,
    studentName: `${st?.firstName ?? ''} ${st?.lastName ?? ''}`.trim(),
    bookedBy: 'prof',
    createdAt: Date.now(),
  };
  await db.meetingBookings.put(b);
}
