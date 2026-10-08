import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { groupOverview } from '../../lib/stats';

export function Dashboard() {
  const counts = useLiveQuery(
    async () => ({
      cards: await db.cards.filter((c) => !c.deleted).count(),
      seqs: await db.units.filter((u) => u.kind === 'sequence').count(),
      groups: await db.groups.filter((g) => !g.archived).count(),
      students: await db.students.count(),
      pubs: await db.publications.count(),
    }),
    [],
  );
  const overviews = useLiveQuery(async () => {
    const gs = await db.groups.filter((g) => !g.archived).toArray();
    return Promise.all(gs.map((g) => groupOverview(g.id)));
  }, []);

  const steps = [
    { done: !!counts?.cards, label: 'Importer votre paquet Anki', to: '/prof/import' },
    { done: !!counts?.seqs, label: 'Créer vos séquences et y ranger les cartes', to: '/prof/sequences' },
    { done: !!counts?.groups, label: 'Créer vos classes et importer les élèves', to: '/prof/classes' },
    { done: !!counts?.pubs, label: 'Publier une séquence pour une classe', to: '/prof/sequences' },
  ];

  return (
    <div className="page stack">
      <div className="row" style={{ gap: 20 }}>
        <img src="./logo.png" alt="" style={{ width: 90 }} />
        <div>
          <h1 className="title" style={{ margin: 0 }}>Bonjour !</h1>
          <div className="muted">
            {counts?.cards ?? 0} cartes · {counts?.seqs ?? 0} séquences · {counts?.groups ?? 0} classes · {counts?.students ?? 0} élèves
          </div>
        </div>
      </div>

      {steps.some((s) => !s.done) && (
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Pour commencer</h2>
          {steps.map((s, i) => (
            <Link key={i} to={s.to} className="row" style={{ textDecoration: 'none', gap: 10 }}>
              <span className="chip" style={{ background: s.done ? 'var(--easy)' : 'var(--paper)', color: s.done ? '#fff' : undefined }}>
                {s.done ? '✓' : i + 1}
              </span>
              <span style={{ textDecoration: s.done ? 'line-through' : 'none', fontWeight: 700 }}>{s.label}</span>
            </Link>
          ))}
          <span className="small muted">
            Astuce : après l'import, le bouton « Générer les données de démo » (onglet Import) crée deux classes fictives avec
            30 jours de révisions pour explorer les statistiques.
          </span>
        </div>
      )}

      <div className="grid3">
        {overviews?.map(
          (o) =>
            o && (
              <Link key={o.group.id} to={`/prof/classes/${o.group.id}`} className="panel stack" style={{ textDecoration: 'none', background: o.group.color ?? 'var(--paper)' }}>
                <h2 style={{ margin: 0 }}>{o.group.name}</h2>
                <div className="muted small">{o.group.subject}</div>
                <div>
                  Score moyen :{' '}
                  <b>{o.rows.length ? Math.round(o.rows.reduce((a, r) => a + r.summary.score, 0) / o.rows.length) : '—'}</b>
                </div>
                <div>
                  À relancer : <b>{o.rows.filter((r) => r.inactiveDays === null || r.inactiveDays >= 5).length}</b>
                </div>
              </Link>
            ),
        )}
      </div>
    </div>
  );
}
