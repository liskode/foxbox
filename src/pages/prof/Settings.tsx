// Réglages : ce qu'on modifie rarement (emploi du temps, classes et élèves, couleurs, compétences, compte).
import { askForm } from '../../components/Dialog';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { Groups } from './Groups';
import { DEFAULT_ORIGINS, loadOrigins, type Origin } from '../../lib/cardCodes';
import { Icon } from '../../components/Icon';

export function Settings() {
  const { session, logout } = useAuth();
  const me = useLiveQuery(() => db.teachers.get(session!.id), [session?.id]);
  const links = [
    ['/prof/edt', 'Emploi du temps et calendrier', 'calendar', 'PDF Pronote, semaines A / B, vacances, jours de présence, cours hors progression'],
    ['/prof/competences', 'Référentiel de compétences', 'target', 'APP, ANA, REA, VAL, COM et leurs sous-compétences'],
    ['/prof/salles', 'Salles', 'seat', 'Disposition des places, pour les plans de classe'],
  ];
  return (
    <div className="page stack">
      <h1 className="title" style={{ margin: 0 }}>
        Réglages
      </h1>
      <div className="grid3">
        {links.map(([to, title, icon, sub]) => (
          <Link key={to} to={to} className="panel strong stack" style={{ gap: 4 }}>
            <b className="row" style={{ gap: 8 }}>
              <Icon name={icon} /> {title}
            </b>
            <span className="small muted">{sub}</span>
          </Link>
        ))}
      </div>
      <ModulesPanel />
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
      <h3 className="panel-title"><Icon name="tag" size={16} /> Origines des flashcards</h3>
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
          onClick={async () => {
            const r = await askForm('Nouvelle origine de flashcards', [
              { key: 'code', label: 'Code (2 lettres)', placeholder: 'MM' },
              { key: 'name', label: 'Nom complet', placeholder: 'Mme Dupont – cours de 4e', optional: true },
            ]);
            if (!r) return;
            const code = r.code.toUpperCase();
            if (!/^[A-Z]{2}$/.test(code)) return alert('Le code doit faire exactement 2 lettres.');
            if (origins.some((o) => o.code === code)) return alert('Ce code existe déjà.');
            save([...origins, { code, name: r.name }]);
          }}
        >
          + Ajouter une origine
        </button>
      </div>
    </div>
  );
}

// Modules facultatifs : n'apparaissent que pour les professeurs qui les activent
function ModulesPanel() {
  const { session } = useAuth();
  const me = useLiveQuery(() => db.teachers.get(session!.id), [session?.id]);
  if (!me) return null;
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <h3 className="panel-title">Modules</h3>
      <label className="row" style={{ gap: 8, fontWeight: 700 }}>
        <input
          type="checkbox"
          checked={!!me.modules?.soutien}
          onChange={(e) => db.teachers.update(me.id, { modules: { ...(me.modules ?? {}), soutien: e.target.checked } })}
        />
        Soutien scolaire
      </label>
      <span className="small muted">
        Élèves suivis en dehors de vos classes (un ou plusieurs, dans une ou plusieurs matières) : séances, programme, documents, flashcards et espace
        élève. Ajoute « Soutien » au menu.
      </span>
    </div>
  );
}
