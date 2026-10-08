// Vue d'ensemble d'une classe, et la liste de ses évaluations.
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SUBJECTS, type Group } from '../lib/db';
import { groupOverview } from '../lib/stats';
import { dateFor, newEvaluation, score, stats } from '../lib/grading';
import { frDate } from '../lib/dates';
import { TodoList } from './TodoList';
import { useProgressSummary } from './Progression';
import { StudentName } from './Avatar';

export function useClassEvaluations(group: Group) {
  return useLiveQuery(async () => {
    const evs = (await db.evaluations.toArray()).filter((e) => !e.template && e.groupIds.includes(group.id));
    const ms = new Set((await db.memberships.where('groupId').equals(group.id).toArray()).map((m) => m.studentId));
    const out = [];
    for (const ev of evs) {
      const rs = (await db.results.where('evaluationId').equals(ev.id).toArray()).filter((r) => ms.has(r.studentId));
      const notes = rs.map((r) => score(ev, r)?.note20).filter((x): x is number => x !== undefined);
      const corrected = rs.filter((r) => r.absent || score(ev, r)).length;
      out.push({ ev, date: dateFor(ev, group.id), corrected, total: ms.size, mean: stats(notes)?.mean });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [group.id], []);
}

export function ClassOverview({ group, goTab }: { group: Group; goTab: (t: string) => void }) {
  const summary = useProgressSummary(group);
  const evals = useClassEvaluations(group);
  const data = useLiveQuery(() => groupOverview(group.id), [group.id]);
  const dropped = data?.rows.filter((r) => r.inactiveDays === null || r.inactiveDays >= 5) ?? [];
  const toCorrect = evals.filter((e) => e.corrected < e.total);
  const mean = data?.rows.length ? Math.round(data.rows.reduce((a, r) => a + r.summary.score, 0) / data.rows.length) : null;

  return (
    <div className="grid2" style={{ alignItems: 'start' }}>
      <div className="stack">
        <div className="panel stack">
          <div className="spread">
            <h3 style={{ margin: 0 }}>Progression</h3>
            <a href="#" className="small" onClick={(e) => (e.preventDefault(), goTab('progression'))}>
              ouvrir →
            </a>
          </div>
          {summary ? (
            <>
              <div className="progress">
                <div style={{ width: `${summary.total ? (summary.done / summary.total) * 100 : 0}%` }} />
              </div>
              <div className="small">
                <b>
                  {summary.done}/{summary.total}
                </b>{' '}
                séance(s) faite(s)
              </div>
              {summary.last && (
                <div>
                  ✓ Dernière : <b>{summary.last.name}</b> <span className="small muted">({frDate(summary.last.date)})</span>
                </div>
              )}
              {summary.next && (
                <div>
                  → Prochaine : <b>{summary.next}</b>
                </div>
              )}
              {!summary.total && <span className="muted small">Aucune séquence suivie pour l'instant.</span>}
            </>
          ) : null}
        </div>

        <div className="panel stack">
          <div className="spread">
            <h3 style={{ margin: 0 }}>Élèves</h3>
            {mean !== null && <span className="small">Score moyen de révision : <b>{mean}</b>/100</span>}
          </div>
          <div className="small">
            <b>{data?.rows.length ?? 0}</b> élève(s) ·{' '}
            <a href="#" onClick={(e) => (e.preventDefault(), goTab('suivi'))}>
              suivi des révisions →
            </a>
          </div>
          {dropped.length > 0 && (
            <>
              <b className="small">⚠️ À relancer (aucune révision depuis 5 jours)</b>
              <div className="row" style={{ gap: 6 }}>
                {dropped.slice(0, 12).map((r) => (
                  <Link key={r.student.id} to={`/prof/eleves/${r.student.id}?classe=${group.id}`} className="chip" style={{ textDecoration: 'none', padding: '2px 10px 2px 2px', background: 'var(--paper)' }}>
                    <StudentName student={r.student} size={24} short />
                  </Link>
                ))}
                {dropped.length > 12 && <span className="small muted">+{dropped.length - 12}</span>}
              </div>
            </>
          )}
        </div>

        <div className="panel stack">
          <div className="spread">
            <h3 style={{ margin: 0 }}>Évaluations</h3>
            <a href="#" className="small" onClick={(e) => (e.preventDefault(), goTab('evaluations'))}>
              toutes →
            </a>
          </div>
          {toCorrect.length > 0 ? (
            toCorrect.map((e) => (
              <Link key={e.ev.id} to={`/prof/correction/${e.ev.id}?onglet=copies`} className="row" style={{ gap: 8 }}>
                ✏️ <b>{e.ev.name}</b>{' '}
                <span className="small muted">
                  {e.corrected}/{e.total} copie(s) corrigée(s)
                </span>
              </Link>
            ))
          ) : (
            <span className="small muted">Aucune copie en attente de correction.</span>
          )}
        </div>
      </div>
      <TodoList groupId={group.id} />
    </div>
  );
}

export function ClassEvaluations({ group }: { group: Group }) {
  const list = useClassEvaluations(group);
  const nav = useNavigate();
  async function create() {
    const ev = newEvaluation(group.subject || SUBJECTS[0], [group.id]);
    await db.evaluations.put(ev);
    nav(`/prof/correction/${ev.id}?onglet=bareme`);
  }
  return (
    <div className="panel stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Évaluations de {group.name}</h3>
        <div className="row">
          <Link to="/prof/correction" className="btn small ghost">
            Modèles…
          </Link>
          <button className="btn small primary" onClick={create}>
            + Nouvelle évaluation
          </button>
        </div>
      </div>
      {!list.length && <span className="muted small">Aucune évaluation pour cette classe.</span>}
      <table className="list">
        <tbody>
          {list.map(({ ev, date, corrected, total, mean }) => (
            <tr key={ev.id} className="click" onClick={() => nav(`/prof/correction/${ev.id}?onglet=resultats`)}>
              <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                {frDate(date)}
              </td>
              <td>
                <b>{ev.name}</b>
              </td>
              <td className="small">
                {corrected}/{total} corrigée(s)
              </td>
              <td style={{ fontWeight: 900 }}>{mean !== undefined ? `${mean}/20` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
