// Progression : vue d'ensemble, une colonne par niveau.
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { unitLabel, themeLabel, levelColors } from '../../../lib/units';
import { sequencesOf, finishedByAll, doneDate, dm } from '../../../lib/forecast';
import { useAuth } from '../../../lib/auth';
import { useHideDone, HideDoneToggle, usePlans, createSequence } from './shared';
import { ClassBilan } from './SequenceScreen';

// Vue d'ensemble : une colonne par niveau
export function LevelsOverview() {
  const data = usePlans();
  const { session } = useAuth();
  const colors = useLiveQuery(() => levelColors(session!.id), [session], {} as Record<string, string>);
  const [hideDone, setHideDone] = useHideDone();
  const nav = useNavigate();
  if (!data) return null;
  const { units } = data;

  return (
    <div className="page stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>
          Progression
        </h1>
        <HideDoneToggle value={hideDone} onChange={setHideDone} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, alignItems: 'start' }}>
        {data.levels.map((lp) => {
          const seqs = sequencesOf(units, lp.level);
          return (
            <div key={lp.level} className="panel stack" style={{ gap: 8, background: colors[lp.level] }}>
              <div className="spread">
                <h2 style={{ margin: 0 }}>{lp.level}</h2>
                <button
                  className="btn small"
                  onClick={async () => {
                    const u = await createSequence(lp.level, units);
                    if (u) nav(`/prof/progression/${u.id}`);
                  }}
                >
                  + Séquence
                </button>
              </div>
              {lp.groups.map((g) => (
                <ClassBilan key={g.id} g={g} plan={lp.plans.get(g.id)} />
              ))}
              {seqs.map((q, i) => {
                const items = lp.items.filter((it) => it.seq.id === q.id);
                if (hideDone && finishedByAll(lp, items)) return null;
                return (
                  <div key={q.id} className="stack" style={{ gap: 4 }}>
                    {(i === 0 || seqs[i - 1].theme !== q.theme) && (
                      <div className="small" style={{ fontWeight: 900, marginTop: 6, color: 'var(--ink-soft)' }}>
                        {themeLabel(q.theme, q.level)}
                      </div>
                    )}
                    <Link
                      to={`/prof/progression/${q.id}`}
                      className="btn"
                      style={{ display: 'block', textAlign: 'left', whiteSpace: 'normal', background: 'var(--paper)' }}
                    >
                      <div>{unitLabel(q)}</div>
                      <div className="row" style={{ gap: 4, marginTop: 4 }}>
                        {lp.groups.map((g) => {
                          const plan = lp.plans.get(g.id);
                          const n = items.filter((it) => doneDate(plan, it)).length;
                          const next = items.map((it) => plan?.planned.get(it.unit.id)).find(Boolean);
                          const all = items.length > 0 && n === items.length;
                          return (
                            <span
                              key={g.id}
                              className="small"
                              title={all ? 'Terminée' : next ? `Prochaine séance prévue le ${dm(next)}` : undefined}
                              style={{
                                borderRadius: 6,
                                padding: '0 5px',
                                fontWeight: 700,
                                background: all ? '#bfe5c9' : n ? '#fff3c4' : 'transparent', // vert : terminée ; jaune : en cours
                                border: `1px ${n ? 'solid' : 'dashed'} ${all ? 'var(--easy)' : n ? '#00000033' : 'var(--muted-line)'}`,
                                color: n ? 'var(--ink)' : '#9a968d',
                              }}
                            >
                              {g.name.replace(/_.*/, '')} {all ? '✓' : n ? `${n}/${items.length}` : next ? dm(next) : ''}
                            </span>
                          );
                        })}
                      </div>
                    </Link>
                  </div>
                );
              })}
              {!seqs.length && <span className="small muted">Aucune séquence.</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
