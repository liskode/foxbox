// Réglages : ce qu'on modifie rarement (emploi du temps, classes et élèves, couleurs, compétences, compte).
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { Groups } from './Groups';

export function Settings() {
  const { session, logout } = useAuth();
  const me = useLiveQuery(() => db.teachers.get(session!.id), [session?.id]);
  const links = [
    ['/prof/edt', '🗓 Emploi du temps et calendrier', 'PDF Pronote, semaines A / B, vacances, jours de présence, cours hors progression'],
    ['/prof/competences', '🎯 Référentiel de compétences', 'APP, ANA, REA, VAL, COM et leurs sous-compétences'],
    ['/prof/trombi', '📷 Trombi toutes classes', 'Entraînement à la mémorisation des prénoms'],
  ];
  return (
    <div className="page stack">
      <h1 className="title" style={{ margin: 0 }}>
        Réglages
      </h1>
      <div className="grid3">
        {links.map(([to, title, sub]) => (
          <Link key={to} to={to} className="panel stack" style={{ gap: 4, textDecoration: 'none', color: 'inherit' }}>
            <b>{title}</b>
            <span className="small muted">{sub}</span>
          </Link>
        ))}
      </div>
      <Groups embedded />
      <div className="panel spread">
        <span>
          Connecté : <b>{me?.name ?? me?.login}</b>
        </span>
        <button className="btn ghost" onClick={logout}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
