// Fuseaux horaires : une séance est fixée à l'heure du professeur (son fuseau est noté avec la séance) ;
// l'élève et les parents la voient à l'heure de leur appareil.
export const DEFAULT_ZONE = 'Europe/Paris'; // séances créées avant la gestion des fuseaux
export const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
};

// Fuseaux proposés pour un élève (nom affiché → fuseau)
export const ZONES: { zone: string; label: string }[] = [
  { zone: 'Europe/Paris', label: 'Paris' },
  { zone: 'Europe/London', label: 'Londres' },
  { zone: 'America/Toronto', label: 'Ottawa, Montréal, Toronto' },
  { zone: 'America/New_York', label: 'New York' },
  { zone: 'America/Chicago', label: 'Dallas, Chicago' },
  { zone: 'America/Denver', label: 'Denver' },
  { zone: 'America/Los_Angeles', label: 'Los Angeles, San Francisco' },
  { zone: 'America/Martinique', label: 'Martinique, Guadeloupe' },
  { zone: 'America/Cayenne', label: 'Guyane' },
  { zone: 'Indian/Reunion', label: 'La Réunion' },
  { zone: 'Pacific/Noumea', label: 'Nouméa' },
  { zone: 'Pacific/Tahiti', label: 'Tahiti' },
  { zone: 'Africa/Casablanca', label: 'Casablanca' },
  { zone: 'Asia/Dubai', label: 'Dubaï' },
];
export const zoneLabel = (zone: string) => ZONES.find((z) => z.zone === zone)?.label.split(',')[0] ?? zone.split('/').pop()!.replace(/_/g, ' ');

const parts = (ts: number, zone: string) => {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(ts));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
};

// Instant (ms) correspondant à une date et une heure lues dans un fuseau
export function zonedToUtc(date: string, time: string, zone: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const offset = (ts: number) => {
    const q = parts(ts, zone);
    const [yy, mm, dd] = q.date.split('-').map(Number);
    const [hh, mn] = q.time.split(':').map(Number);
    return Date.UTC(yy, mm - 1, dd, hh, mn) - ts;
  };
  let ts = wall - offset(wall);
  ts = wall - offset(ts); // second passage : changement d'heure
  return ts;
}

// Date (AAAA-MM-JJ) et heure (HH:MM) d'un instant dans un fuseau
export const inZone = (ts: number, zone: string) => parts(ts, zone);
