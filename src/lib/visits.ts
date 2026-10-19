// Journal des connexions des élèves et des parents : début, puis dernière activité notée chaque minute
// tant que la page est affichée. Après 30 minutes sans activité, une nouvelle connexion commence.
import { db, uid, type Visit } from './db';
import type { Session } from './auth';

const IDLE = 30 * 60_000;
let current: Visit | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

async function who(s: Session): Promise<Pick<Visit, 'name' | 'studentIds'> | null> {
  if (s.role === 'eleve') {
    const st = await db.students.get(s.id);
    return { name: st?.firstName ?? 'Élève', studentIds: [s.id] };
  }
  const p = await db.parents.get(s.id);
  return p ? { name: p.name, studentIds: p.studentIds } : null;
}

async function beat(s: Session) {
  if (document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (current && now - current.last < IDLE) {
    current = { ...current, last: now };
    await db.visits.update(current.id, { last: now });
    return;
  }
  const w = await who(s);
  if (!w) return;
  current = { id: uid(), userId: s.id, role: s.role as Visit['role'], ...w, start: now, last: now };
  await db.visits.put(current);
}

let trackedFor: string | null = null;
// Appelé à chaque page : ne démarre le suivi qu'une fois par compte connecté
export function trackVisits(s: Session) {
  if (s.role === 'prof' || trackedFor === s.id) return;
  stopVisits();
  trackedFor = s.id;
  const tick = () => beat(s).catch(() => undefined);
  tick();
  timer = setInterval(tick, 60_000);
  document.addEventListener('visibilitychange', tick);
  stop = () => document.removeEventListener('visibilitychange', tick);
}
let stop = () => {};
export function stopVisits() {
  if (timer) clearInterval(timer);
  timer = null;
  stop();
  current = null;
  trackedFor = null;
}
