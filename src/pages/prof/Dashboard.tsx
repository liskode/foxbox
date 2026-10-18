// Accueil : 4 tuiles (Progression, Évaluations, Flashcards, Élève), emploi du temps (accès aux classes), À faire.
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isClass } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { addDays, today } from '../../lib/dates';
import { levelPlans } from '../../lib/forecast';
import { TodoList } from '../../components/TodoList';
import { TimetableWidget } from '../../components/TimetableWidget';
import { StudentSearch } from '../../components/StudentSearch';
import { useOverview } from './Correction';
import { syncAllShares } from '../../lib/grading';
import { Icon } from '../../components/Icon';

// Tuile : toute la tuile s'ouvre d'un clic (gros cadre = cliquable) ; l'alerte est une étiquette de couleur
function Tile({ to, icon, title, sub, alert, children }: { to: string; icon: string; title: string; sub: string; alert?: ReactNode; children?: ReactNode }) {
  const head = (
    <>
      <span className="tile-head">
        <Icon name={icon} size={20} />
        {title}
      </span>
      <span className="small muted">{sub}</span>
    </>
  );
  if (children)
    return (
      <div className="panel strong stack tile" style={{ gap: 8 }}>
        <Link to={to} className="stack" style={{ gap: 2, textDecoration: 'none', color: 'inherit' }}>
          {head}
        </Link>
        {children}
      </div>
    );
  return (
    <Link to={to} className="panel strong stack tile" style={{ gap: 2 }}>
      {head}
      {alert && <div style={{ marginTop: 'auto', paddingTop: 10 }}>{alert}</div>}
    </Link>
  );
}

const Alert = ({ kind, children }: { kind: 'ok' | 'warn' | 'bad'; children: ReactNode }) => (
  <span className={'tag ' + kind}>
    <Icon name={kind === 'ok' ? 'check' : 'alert'} size={14} />
    {children}
  </span>
);

function useAlerts() {
  const { session } = useAuth();
  return useLiveQuery(async () => {
    const plans = await levelPlans(session!.id);
    const late = plans.levels.flatMap((l) => l.groups.filter((g) => l.plans.get(g.id)?.overflowWeeks).map((g) => g.name.replace(/_.*/, '')));
    // Élèves sans révision depuis 5 jours : une seule lecture des révisions (et non une par élève)
    const groups = await db.groups.filter((g) => !g.archived).toArray();
    const ids = new Set(groups.map((g) => g.id));
    const students = new Set((await db.memberships.toArray()).filter((m) => ids.has(m.groupId)).map((m) => m.studentId));
    const last = new Map<string, string>();
    await db.reviews.each((r) => {
      if (students.has(r.studentId) && r.date > (last.get(r.studentId) ?? '')) last.set(r.studentId, r.date);
    });
    const limit = addDays(today(), -5);
    const relancer = [...students].filter((id) => !last.has(id) || last.get(id)! <= limit).length;
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
    groups: await db.groups.filter((g) => !g.archived && isClass(g)).count(),
  }));

  const steps = [
    { done: !!counts?.groups, label: 'Créer vos classes et importer les élèves (Réglages)', to: '/prof/reglages' },
    { done: !!counts?.seqs, label: 'Préparer vos séquences et séances (Progression)', to: '/prof/progression' },
    { done: !!counts?.cards, label: 'Importer vos flashcards (Flashcards › Import)', to: '/prof/flashcards?onglet=import' },
  ];

  return (
    <div className="page stack" style={{ maxWidth: 1400 }}>
      {counts && steps.some((s) => !s.done) && (
        <div className="panel note stack">
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
          icon="chart"
          title="Progression"
          sub="Séquences, séances"
          alert={alerts && (alerts.late.length ? <Alert kind="bad">En retard : {alerts.late.join(', ')}</Alert> : <Alert kind="ok">Dans les temps</Alert>)}
        />
        <Tile
          to="/prof/correction"
          icon="eval"
          title="Évaluations"
          sub="Corrections, compétences"
          alert={evals && (toCorrect ? <Alert kind="warn">{toCorrect} classe(s) à corriger</Alert> : <Alert kind="ok">Rien à corriger</Alert>)}
        />
        <Tile
          to="/prof/flashcards"
          icon="cards"
          title="Flashcards"
          sub="Liste, import, statistiques"
          alert={alerts && (alerts.relancer ? <Alert kind="warn">{alerts.relancer} élève(s) à relancer</Alert> : <Alert kind="ok">Tout le monde révise</Alert>)}
        />
        <Tile to="/prof/eleves" icon="user" title="Élève" sub="Trombis, plans de classe, fiches">
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
