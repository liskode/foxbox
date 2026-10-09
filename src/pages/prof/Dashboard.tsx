// Tableau de bord : emploi du temps (accès aux classes), trombi, to-do list.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Group } from '../../lib/db';
import { TodoList } from '../../components/TodoList';
import { TimetableWidget } from '../../components/TimetableWidget';

// Bouton « Trombi » : choix de la classe, puis ouverture de l'onglet Trombi de la classe
function TrombiButton({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  return (
    <div className="stack" style={{ gap: 8, alignItems: 'flex-end' }}>
      <button className="btn" onClick={() => setOpen(!open)}>
        📷 Trombi
      </button>
      {open && (
        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
          <span className="small muted">Quelle classe ?</span>
          {groups.map((g) => (
            <button key={g.id} className="btn small" style={{ background: g.color ?? 'var(--paper)' }} onClick={() => nav(`/prof/classes/${g.id}?onglet=trombi`)}>
              {g.name}
            </button>
          ))}
        </div>
      )}
    </div>
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
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 16 }}>
          <img src="./logo.png" alt="" style={{ width: 70 }} />
          <h1 className="title" style={{ margin: 0 }}>Tableau de bord</h1>
        </div>
        <TrombiButton groups={groups} />
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

      <TodoList />
    </div>
  );
}
