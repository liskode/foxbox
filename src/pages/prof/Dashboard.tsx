// Accueil : 4 tuiles (Progression, Évaluations, Flashcards, Élève), emploi du temps (accès aux classes), À faire.
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { groupOverview } from '../../lib/stats';
import { levelPlans } from '../../lib/forecast';
import { TodoList } from '../../components/TodoList';
import { TimetableWidget } from '../../components/TimetableWidget';
import { StudentSearch } from '../../components/StudentSearch';
import { useOverview } from './Correction';
import { syncAllShares } from '../../lib/grading';

function Tile({ to, title, sub, alert, children }: { to: string; title: string; sub: string; alert?: ReactNode; children?: ReactNode }) {
  return (
    <div className="panel stack tile" style={{ gap: 6 }}>
      <Link to={to} className="stack" style={{ gap: 2, textDecoration: 'none', color: 'inherit' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className="small muted">{sub}</span>
      </Link>
      {alert && <div className="small">{alert}</div>}
      {children}
    </div>
  );
}

function useAlerts() {
  const { session } = useAuth();
  return useLiveQuery(async () => {
    const plans = await levelPlans(session!.id);
    const late = plans.levels.flatMap((l) => l.groups.filter((g) => l.plans.get(g.id)?.overflowWeeks).map((g) => g.name.replace(/_.*/, '')));
    let relancer = 0;
    for (const g of await db.groups.filter((g) => !g.archived).toArray()) {
      const ov = await groupOverview(g.id);
      relancer += ov?.rows.filter((r) => r.inactiveDays === null || r.inactiveDays >= 5).length ?? 0;
    }
    return { late, relancer };
  }, [session?.id]);
}

export function Dashboard() {
  // Une fois : les copies déjà rendues reçoivent l'histogramme par compétence dans l'espace élève
  useEffect(() => {
    (async () => {
      if (await db.meta.get('shares-competences')) return;
      for (const ev of await db.evaluations.toArray()) if (!ev.template) await syncAllShares(ev);
      await db.meta.put({ key: 'shares-competences', value: true });
    })();
  }, []);
  const alerts = useAlerts();
  const evals = useOverview();
  const toCorrect = evals?.rows.reduce((a, r) => a + r.pills.filter((p) => p.state === 'grading').length, 0) ?? 0;
  const counts = useLiveQuery(async () => ({
    cards: await db.cards.filter((c) => !c.deleted).count(),
    seqs: await db.units.filter((u) => u.kind === 'sequence').count(),
    groups: await db.groups.filter((g) => !g.archived).count(),
  }));

  const steps = [
    { done: !!counts?.groups, label: 'Créer vos classes et importer les élèves (⚙️ Réglages)', to: '/prof/reglages' },
    { done: !!counts?.seqs, label: 'Préparer vos séquences et séances (Progression)', to: '/prof/progression' },
    { done: !!counts?.cards, label: 'Importer vos cartes (Flashcards › Import)', to: '/prof/flashcards?onglet=import' },
  ];

  return (
    <div className="page stack" style={{ maxWidth: 1400 }}>
      {counts && steps.some((s) => !s.done) && (
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

      <div className="home-grid">
        <Tile
          to="/prof/progression"
          title="Progression"
          sub="Séquences, séances"
          alert={alerts && (alerts.late.length ? <b style={{ color: 'var(--forgot)' }}>⚠️ En retard : {alerts.late.join(', ')}</b> : <span className="muted">✓ Programme dans les temps</span>)}
        />
        <Tile
          to="/prof/correction"
          title="Évaluations"
          sub="Évaluations, corrections, compétences"
          alert={evals && (toCorrect ? <b>✏️ {toCorrect} copie(s) de classe à corriger</b> : <span className="muted">✓ Rien à corriger</span>)}
        />
        <Tile
          to="/prof/flashcards"
          title="Flashcards"
          sub="Cartes, import, statistiques"
          alert={alerts && (alerts.relancer ? <b>⚠️ {alerts.relancer} élève(s) à relancer</b> : <span className="muted">✓ Tout le monde révise</span>)}
        />
        <Tile to="/prof/eleves" title="Élève" sub="Recherche rapide, trombis">
          <StudentSearch max={5} />
        </Tile>
        <div className="home-edt">
          <TimetableWidget />
        </div>
        <div className="home-todo">
          <TodoList />
        </div>
      </div>
    </div>
  );
}
