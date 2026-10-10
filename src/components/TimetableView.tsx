// Affichage de l'emploi du temps : grille de la semaine et liste des cours d'une journée.
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Group } from '../lib/db';
import { useAuth } from '../lib/auth';
import { addDays, fromISO, today } from '../lib/dates';
import { DAYS, countsForProgress, isPresent, loadTimetable, matchGroup, minutes, shortTime, slotsOn, type Slot, type Timetable, type WeekType } from '../lib/timetable';
import { useProgressSummary } from './Progression';

export function useTimetable() {
  const { session } = useAuth();
  return useLiveQuery(() => loadTimetable(session!.id), [session?.id]);
}

export function useGroups() {
  return useLiveQuery(() => db.groups.filter((g) => !g.archived).toArray(), [], [] as Group[]);
}

export const groupOfSlot = (s: Slot, groups: Group[]) => groups.find((g) => g.id === s.groupId) ?? matchGroup(s.label, groups);

const SUBJECT_SHORT: Record<string, string> = {
  'PHYSIQUE-CHIMIE': 'Physique-chimie',
  'ENS.INTEG.SC.&TECHNO': 'Sciences & techno',
  'DEVOIRS FAITS': 'Devoirs faits',
};
export const subjectLabel = (s: string) => SUBJECT_SHORT[s] ?? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export const longDate = (iso: string) => fromISO(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = (iso: string) => fromISO(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// Grille d'une semaine. Avec `monday`, affiche les dates, les jours fériés et la semaine réelle (A/B) ;
// sans `monday`, affiche la semaine type `week`.
export function WeekGrid({
  tt,
  groups,
  monday,
  week,
  compact = false,
  onSlot,
  onToggleHp,
  selected,
}: {
  tt: Timetable;
  groups: Group[];
  monday?: string;
  week?: WeekType;
  compact?: boolean;
  onSlot?: (s: Slot) => void;
  onToggleHp?: (s: Slot) => void; // bascule « P » (compte pour la progression) / « HP » (hors progression)
  selected?: string;
}) {
  const days = tt.slots.some((s) => s.day === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const all = tt.slots.length ? tt.slots : [];
  const from = Math.min(8 * 60, ...all.map((s) => minutes(s.start)));
  const to = Math.max(17 * 60 + 30, ...all.map((s) => minutes(s.end)));
  const ppm = compact ? 0.62 : 0.95; // pixels par minute
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hours: number[] = [];
  for (let h = Math.ceil(from / 60); h * 60 <= to; h++) hours.push(h);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `34px repeat(${days.length}, minmax(0, 1fr))`, gap: 4 }}>
      <div />
      {days.map((d) => {
        const date = monday ? addDays(monday, d - 1) : undefined;
        const isToday = date === today();
        return (
          <div key={d} className="small" style={{ textAlign: 'center', fontWeight: 800, opacity: isPresent(tt, d) ? 1 : 0.45 }}>
            <span style={isToday ? { background: 'var(--matiere)', borderRadius: 8, padding: '1px 6px' } : undefined}>
              {compact ? DAYS[d].slice(0, 3) + '.' : DAYS[d]}
              {date && ` ${fromISO(date).getDate()}`}
            </span>
          </div>
        );
      })}
      <div style={{ position: 'relative', height: (to - from) * ppm }}>
        {hours.map((h) => (
          <span key={h} className="small muted" style={{ position: 'absolute', top: (h * 60 - from) * ppm - 8, right: 2, fontSize: '0.7rem' }}>
            {h}h
          </span>
        ))}
      </div>
      {days.map((d) => {
        const date = monday ? addDays(monday, d - 1) : undefined;
        const off = date && tt.off.includes(date);
        const slots = date ? slotsOn(tt, date) : tt.slots.filter((s) => s.day === d && (s.week === 'AB' || s.week === week));
        const isToday = date === today();
        return (
          <div
            key={d}
            style={{
              position: 'relative',
              height: (to - from) * ppm,
              background: off ? 'repeating-linear-gradient(45deg, #eee, #eee 6px, #f8f8f8 6px, #f8f8f8 12px)' : '#fbfaf7',
              borderRadius: 8,
              border: `2px solid ${isToday ? 'var(--matiere)' : 'var(--muted-line)'}`,
              opacity: isPresent(tt, d) ? 1 : 0.5,
            }}
          >
            {hours.map((h) => (
              <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: (h * 60 - from) * ppm, borderTop: '1px dashed #e4e0d8' }} />
            ))}
            {off && (
              <span className="small muted" style={{ position: 'absolute', top: 8, width: '100%', textAlign: 'center' }}>
                Férié
              </span>
            )}
            {isToday && nowMin > from && nowMin < to && (
              <div style={{ position: 'absolute', left: -2, right: -2, top: (nowMin - from) * ppm, borderTop: '2px solid var(--forgot)', zIndex: 2 }} />
            )}
            {slots.map((s) => {
              const g = groupOfSlot(s, groups);
              const top = (minutes(s.start) - from) * ppm;
              const h = (minutes(s.end) - minutes(s.start)) * ppm;
              const box = (
                <div
                  style={{
                    position: 'absolute',
                    top,
                    height: h - 2,
                    left: 2,
                    right: 2,
                    overflow: 'hidden',
                    background: g?.color ?? '#ece9e2',
                    border: `2px ${countsForProgress(s) ? 'solid' : 'dashed'} ${selected === s.id ? 'var(--ink)' : '#00000033'}`,
                    opacity: countsForProgress(s) ? 1 : 0.6,
                    borderRadius: 6,
                    padding: '1px 4px',
                    fontSize: compact ? '0.7rem' : '0.78rem',
                    lineHeight: 1.15,
                    cursor: onSlot ? 'pointer' : undefined,
                  }}
                  title={`${shortTime(s.start)}–${shortTime(s.end)} · ${subjectLabel(s.subject)} · ${s.label}${s.room ? ` · ${s.room}` : ''}${s.aide ? ` · AESH : ${s.aide}` : ''}`}
                  onClick={onSlot ? () => onSlot(s) : undefined}
                >
                  {onToggleHp && (
                    <button
                      className="small"
                      title={countsForProgress(s) ? 'Compte pour la progression (cliquer pour passer hors progression)' : 'Hors progression'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleHp(s);
                      }}
                      style={{
                        float: 'right',
                        border: 'none',
                        borderRadius: 4,
                        padding: '0 3px',
                        fontSize: '0.65rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        background: countsForProgress(s) ? 'var(--ink)' : '#d9d5cc',
                        color: countsForProgress(s) ? '#fff' : '#77736b',
                      }}
                    >
                      {countsForProgress(s) ? 'P' : 'HP'}
                    </button>
                  )}
                  <b>{s.label.replace(/[[\]]/g, '') || subjectLabel(s.subject)}</b>
                  {s.week !== 'AB' && !date && <span className="muted"> · {s.week}</span>}
                  {!compact && h > 30 && <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{subjectLabel(s.subject)}</div>}
                  {h > 44 && s.room && <div className="muted">{s.room}</div>}
                </div>
              );
              return g && !onSlot ? (
                <Link key={s.id} to={`/prof/classes/${g.id}?onglet=apercu`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {box}
                </Link>
              ) : (
                <div key={s.id}>{box}</div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function NextSeance({ g }: { g: Group }) {
  const sum = useProgressSummary(g);
  if (!sum?.next) return null;
  return <div className="small">→ {sum.next}</div>;
}

// Cours d'une journée, avec la prochaine séance prévue pour chaque classe
export function DayList({ tt, groups, date }: { tt: Timetable; groups: Group[]; date: string }) {
  const slots = slotsOn(tt, date);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = date === today();
  return (
    <div className="stack" style={{ gap: 6 }}>
      {slots.map((s) => {
        const g = groupOfSlot(s, groups);
        const current = isToday && nowMin >= minutes(s.start) && nowMin < minutes(s.end);
        const past = isToday && nowMin >= minutes(s.end);
        const body = (
          <div
            className="row"
            style={{
              gap: 10,
              flexWrap: 'nowrap',
              alignItems: 'flex-start',
              padding: '6px 8px',
              borderRadius: 10,
              background: g?.color ?? '#f1efe9',
              border: `2px solid ${current ? 'var(--ink)' : 'transparent'}`,
              opacity: past ? 0.55 : 1,
            }}
          >
            <span className="code" style={{ minWidth: 92 }}>
              {shortTime(s.start)}–{shortTime(s.end)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>
                <b>{s.label.replace(/[[\]]/g, '') || '—'}</b> · {subjectLabel(s.subject)}
                {s.room && <span className="muted small"> · {s.room}</span>}
                {s.aide && <span className="small"> · AESH {s.aide}</span>}
              </div>
              {g && <NextSeance g={g} />}
            </div>
          </div>
        );
        return g ? (
          <Link key={s.id} to={`/prof/classes/${g.id}?onglet=apercu`} style={{ color: 'inherit', textDecoration: 'none' }}>
            {body}
          </Link>
        ) : (
          <div key={s.id}>{body}</div>
        );
      })}
    </div>
  );
}

export { shortDate };
