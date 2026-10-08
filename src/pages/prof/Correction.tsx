// Onglet Correction : liste des évaluations et des modèles.
import { useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SUBJECTS, type Evaluation } from '../../lib/db';
import { newEvaluation, duplicate, score, stats, dateFor } from '../../lib/grading';
import { frDate } from '../../lib/dates';

function useGroups() {
  return useLiveQuery(() => db.groups.toArray(), [], []);
}

function EvalCard({ ev }: { ev: Evaluation }) {
  const groups = useGroups();
  const info = useLiveQuery(async () => {
    const rs = await db.results.where('evaluationId').equals(ev.id).toArray();
    const ids = new Set<string>();
    for (const g of ev.groupIds) (await db.memberships.where('groupId').equals(g).toArray()).forEach((m) => ids.add(m.studentId));
    const notes = rs.map((r) => score(ev, r)?.note20).filter((x): x is number => x !== undefined);
    const done = rs.filter((r) => r.absent || score(ev, r)).length;
    return { done, total: ids.size, mean: stats(notes)?.mean };
  }, [ev]);
  return (
    <Link to={`/prof/correction/${ev.id}`} className="panel stack" style={{ textDecoration: 'none', gap: 6 }}>
      <h3 style={{ margin: 0 }}>{ev.name}</h3>
      <div className="muted small">
        {ev.criteria.length} critère(s)
      </div>
      <div className="row" style={{ gap: 4 }}>
        {ev.groupIds.map((id) => {
          const g = groups.find((x) => x.id === id);
          return g ? (
            <span key={id} className="chip" style={{ background: g.color ?? 'var(--paper)' }}>
              {g.name} · {frDate(dateFor(ev, id))}
            </span>
          ) : null;
        })}
      </div>
      {info && (
        <div className="small">
          <b>
            {info.done}/{info.total}
          </b>{' '}
          copie(s) corrigée(s){info.mean !== undefined && <> · moyenne <b>{info.mean}/20</b></>}
        </div>
      )}
    </Link>
  );
}

export function Correction() {
  const nav = useNavigate();
  const evs = useLiveQuery(() => db.evaluations.toArray(), [], []);
  const groups = useGroups();
  const last = (e: Evaluation) => [e.date, ...e.groupIds.map((g) => dateFor(e, g))].sort().pop()!;
  const list = evs.filter((e) => !e.template).sort((a, b) => last(b).localeCompare(last(a)) || b.createdAt - a.createdAt);
  const templates = evs.filter((e) => e.template).sort((a, b) => a.name.localeCompare(b.name));

  async function create() {
    const ev = newEvaluation(SUBJECTS[0], []);
    await db.evaluations.put(ev);
    nav(`/prof/correction/${ev.id}?onglet=bareme`);
  }

  async function fromTemplate(t: Evaluation) {
    const ev = duplicate(t);
    await db.evaluations.put(ev);
    nav(`/prof/correction/${ev.id}?onglet=bareme`);
  }

  return (
    <div className="page stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>Correction</h1>
        <button className="btn primary" onClick={create}>
          + Nouvelle évaluation
        </button>
      </div>
      {!list.length && (
        <div className="notice">
          Créez une évaluation (ou partez d'un modèle ci-dessous), choisissez la ou les classes, saisissez le barème par
          critère, puis corrigez copie par copie.
        </div>
      )}
      <div className="grid3">
        {list.map((ev) => (
          <EvalCard key={ev.id} ev={ev} />
        ))}
      </div>
      {templates.length > 0 && (
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Modèles</h2>
          <span className="small muted">Une évaluation déjà construite (critères et barème), à réutiliser pour de nouvelles classes.</span>
          <table className="list">
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.name}</b>
                  </td>
                  <td className="small muted">
                    {t.criteria.length} critères · {Math.round(t.criteria.reduce((a, c) => a + c.points, 0) * 10) / 10} pts
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link className="btn small ghost" to={`/prof/correction/${t.id}?onglet=bareme`}>
                      Modifier
                    </Link>{' '}
                    <button className="btn small primary" onClick={() => fromTemplate(t)}>
                      Utiliser
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {groups.length === 0 && <div className="small muted">Astuce : créez d'abord vos classes dans l'onglet Classes.</div>}
    </div>
  );
}
