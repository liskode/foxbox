// Tableau de bord : to-do list, classes (avec leur avancement), évaluations à corriger.
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Group } from '../../lib/db';
import { groupOverview } from '../../lib/stats';
import { TodoList } from '../../components/TodoList';
import { TimetableWidget } from '../../components/TimetableWidget';
import { useProgressSummary } from '../../components/Progression';
import { useClassEvaluations } from '../../components/ClassOverview';

function ClassCard({ g }: { g: Group }) {
  const summary = useProgressSummary(g);
  const evals = useClassEvaluations(g);
  const ov = useLiveQuery(() => groupOverview(g.id), [g.id]);
  const dropped = ov?.rows.filter((r) => r.inactiveDays === null || r.inactiveDays >= 5).length ?? 0;
  const toCorrect = evals.filter((e) => e.corrected < e.total).length;
  return (
    <Link to={`/prof/classes/${g.id}`} className="panel stack" style={{ textDecoration: 'none', background: g.color ?? 'var(--paper)', gap: 6 }}>
      <div className="spread">
        <h2 style={{ margin: 0 }}>{g.name}</h2>
        <span className="small">{ov?.rows.length ?? 0} élèves</span>
      </div>
      {summary && summary.total > 0 && (
        <>
          <div className="progress" style={{ background: '#ffffffaa' }}>
            <div style={{ width: `${(summary.done / summary.total) * 100}%` }} />
          </div>
          <div className="small">
            {summary.next ? (
              <>
                → <b>{summary.next}</b>
              </>
            ) : (
              '✓ Progression terminée'
            )}
          </div>
        </>
      )}
      <div className="row small" style={{ gap: 10 }}>
        {toCorrect > 0 && <span>✏️ {toCorrect} évaluation(s) à corriger</span>}
        {dropped > 0 && <span>⚠️ {dropped} à relancer</span>}
        {!toCorrect && !dropped && <span className="muted">Rien à signaler</span>}
      </div>
    </Link>
  );
}

export function Dashboard() {
  const groups = useLiveQuery(
    async () => (await db.groups.filter((g) => !g.archived).toArray()).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })),
    [],
    [],
  );
  const counts = useLiveQuery(async () => ({ cards: await db.cards.filter((c) => !c.deleted).count(), seqs: await db.units.filter((u) => u.kind === 'sequence').count() }), []);

  const steps = [
    { done: !!counts?.cards, label: 'Importer vos cartes (Bibliothèque › Import)', to: '/prof/import' },
    { done: !!counts?.seqs, label: 'Préparer vos séquences et séances (Bibliothèque › Séquences)', to: '/prof/sequences' },
    { done: groups.length > 0, label: 'Créer vos classes et importer les élèves', to: '/prof/classes' },
  ];

  return (
    <div className="page stack">
      <div className="row" style={{ gap: 16 }}>
        <img src="./logo.png" alt="" style={{ width: 70 }} />
        <h1 className="title" style={{ margin: 0 }}>Tableau de bord</h1>
      </div>

      {steps.some((s) => !s.done) && (
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>Pour commencer</h3>
          {steps.map((s, i) => (
            <Link key={i} to={s.to} className="row" style={{ textDecoration: 'none', gap: 10 }}>
              <span className="chip" style={{ background: s.done ? 'var(--easy)' : 'var(--paper)', color: s.done ? '#fff' : undefined }}>
                {s.done ? '✓' : i + 1}
              </span>
              <span style={{ textDecoration: s.done ? 'line-through' : 'none', fontWeight: 700 }}>{s.label}</span>
            </Link>
          ))}
        </div>
      )}

      <TimetableWidget />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div className="stack">
          <div className="spread">
            <h2 style={{ margin: 0 }}>Mes classes</h2>
            <div className="row">
              <Link to="/prof/trombi" className="btn small ghost">
                Trombi toutes classes
              </Link>
              <Link to="/prof/classes" className="btn small ghost">
                Gérer les classes
              </Link>
            </div>
          </div>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
            {groups.map((g) => (
              <ClassCard key={g.id} g={g} />
            ))}
          </div>
        </div>
        <TodoList />
      </div>
    </div>
  );
}
