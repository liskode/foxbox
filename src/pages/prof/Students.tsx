// Élèves : recherche rapide et accès directs par classe (vue d'ensemble, trombis, plans de classe, fiches identifiants).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Group } from '../../lib/db';
import { StudentSearch, useAllStudents } from '../../components/StudentSearch';

function Line({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="panel row" style={{ gap: 10, alignItems: 'flex-start', padding: '12px 16px' }}>
      <b style={{ width: 150, flex: 'none', paddingTop: 6 }}>{title}</b>
      <div className="row" style={{ gap: 6, flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

const Chip = ({ g, to, prefix = '' }: { g: Group; to: string; prefix?: string }) => (
  <Link to={to} className="chip" style={{ background: g.color ?? 'var(--paper)', textDecoration: 'none', padding: '4px 12px' }}>
    {prefix}
    {g.name}
  </Link>
);

export function Students() {
  const data = useAllStudents();
  const groups = data?.groups ?? [];

  return (
    <div className="page stack" style={{ gap: 12 }}>
      <h1 className="title" style={{ margin: 0 }}>
        Élèves
      </h1>
      <div className="panel row" style={{ gap: 16, alignItems: 'flex-start', padding: '12px 16px' }}>
        <div style={{ flex: 1, minWidth: 260, maxWidth: 480 }}>
          <StudentSearch autoFocus max={12} />
        </div>
        <div className="row" style={{ gap: 6, flex: 1 }}>
          <span className="small muted">Classes :</span>
          {groups.map((g) => (
            <Chip key={g.id} g={g} to={`/prof/classes/${g.id}?onglet=apercu`} />
          ))}
        </div>
      </div>
      <Line title="📷 Trombis">
        {groups.map((g) => (
          <Chip key={g.id} g={g} to={`/prof/classes/${g.id}?onglet=trombi`} />
        ))}
        <Link to="/prof/trombi" className="chip" style={{ textDecoration: 'none', padding: '4px 12px', background: 'var(--matiere)' }}>
          Toutes les classes
        </Link>
      </Line>
      <Line title="🪑 Plans de classe">
        {groups.map((g) => (
          <Chip key={g.id} g={g} to={`/prof/classes/${g.id}?onglet=plan`} />
        ))}
        <Link to="/prof/reglages" className="btn small ghost" title="Créer une classe et importer ses élèves (⚙️ Réglages)">
          + Ajouter une classe
        </Link>
      </Line>
      <Line title="🖨 Fiches identifiants">
        {groups.map((g) => (
          <Chip key={g.id} g={g} to={`/prof/classes/${g.id}/fiches`} />
        ))}
      </Line>
      <span className="small muted">
        {data?.students.length ?? 0} élèves dans {groups.length} classes · recherche sans accents, Entrée ouvre le premier résultat.
      </span>
    </div>
  );
}
