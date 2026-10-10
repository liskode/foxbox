// Élèves : recherche rapide dans toutes les classes, trombis par classe (entraînement, impression A4).
import { Link, useSearchParams } from 'react-router-dom';
import { StudentSearch, useAllStudents } from '../../components/StudentSearch';
import { Trombi } from './Trombi';

export function Students() {
  const data = useAllStudents();
  const [params, setParams] = useSearchParams();
  const gid = params.get('trombi');
  const groups = data?.groups ?? [];
  const g = groups.find((x) => x.id === gid);

  return (
    <div className="page stack">
      <h1 className="title" style={{ margin: 0 }}>
        Élèves
      </h1>
      <div className="panel stack" style={{ maxWidth: 560 }}>
        <b>Rechercher un élève</b>
        <StudentSearch autoFocus max={12} />
        <span className="small muted">{data?.students.length ?? 0} élèves dans {groups.length} classes. Entrée ouvre le premier résultat.</span>
      </div>
      <div className="panel stack">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Trombis</h2>
          <Link to="/prof/trombi" className="btn small ghost">
            S'entraîner sur toutes les classes
          </Link>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {groups.map((x) => (
            <button
              key={x.id}
              className={'chip' + (x.id === gid ? '' : gid ? ' off' : '')}
              style={{ background: x.color ?? 'var(--paper)' }}
              onClick={() => setParams(x.id === gid ? {} : { trombi: x.id }, { replace: true })}
            >
              {x.name}
            </button>
          ))}
        </div>
        {g ? (
          <div className="stack">
            <div className="row">
              <Link to={`/prof/classes/${g.id}?onglet=eleves`} className="btn small ghost">
                Liste des élèves de {g.name}
              </Link>
              <Link to={`/prof/trombi/imprimer/${g.id}`} className="btn small">
                🖨 Imprimer le trombi A4
              </Link>
            </div>
            <Trombi key={g.id} groupId={g.id} />
          </div>
        ) : (
          <span className="small muted">Choisissez une classe pour voir son trombi, vous entraîner sur les prénoms ou l'imprimer.</span>
        )}
      </div>
    </div>
  );
}
