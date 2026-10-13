// Réglages : ce qu'on modifie rarement (emploi du temps, classes et élèves, couleurs, compétences, compte).
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { Groups } from './Groups';
import { DEFAULT_ORIGINS, loadOrigins, type Origin } from '../../lib/cardCodes';

export function Settings() {
  const { session, logout } = useAuth();
  const me = useLiveQuery(() => db.teachers.get(session!.id), [session?.id]);
  const links = [
    ['/prof/edt', '🗓 Emploi du temps et calendrier', 'PDF Pronote, semaines A / B, vacances, jours de présence, cours hors progression'],
    ['/prof/competences', '🎯 Référentiel de compétences', 'APP, ANA, REA, VAL, COM et leurs sous-compétences'],
    ['/prof/salles', '🪑 Salles', 'Disposition des places, pour les plans de classe'],
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
      <OriginsPanel />
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

// Origines des flashcards (2 lettres dans le code, ex. 43MM-012)
function OriginsPanel() {
  const { session } = useAuth();
  const origins = useLiveQuery(() => loadOrigins(session!.id), [session?.id], DEFAULT_ORIGINS);
  const save = (list: Origin[]) => db.teachers.update(session!.id, { origins: list });
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <h3 style={{ margin: 0 }}>🏷 Origines des flashcards</h3>
      <span className="small muted">
        Code des flashcards : niveau + thème + origine + numéro, ex. <span className="code">43MM-012</span> (4e, Énergie, origine MM, n° 12). Niveau 9 /
        thème 9 = transversal ; niveau 0 = Terminale.
      </span>
      {origins.map((o, i) => (
        <div key={i} className="row" style={{ gap: 8 }}>
          <span className="code" style={{ width: 40 }}>
            {o.code}
          </span>
          <input
            defaultValue={o.name}
            placeholder="Nom complet"
            onBlur={(e) => save(origins.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            style={{ width: 260 }}
          />
        </div>
      ))}
      <div>
        <button
          className="btn small"
          onClick={() => {
            const code = prompt('Code de l’origine (2 lettres, ex. MM)')?.trim().toUpperCase();
            if (!code) return;
            if (!/^[A-Z]{2}$/.test(code)) return alert('Le code doit faire exactement 2 lettres.');
            if (origins.some((o) => o.code === code)) return alert('Ce code existe déjà.');
            const name = prompt('Nom complet (ex. Mme Dupont – cours de 4e)') ?? '';
            save([...origins, { code, name }]);
          }}
        >
          + Ajouter une origine
        </button>
      </div>
    </div>
  );
}
