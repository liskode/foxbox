// Flashcards : cartes (recherche, création), import, statistiques de révision par classe, fiches de connexion.
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { Cards } from './Cards';
import { ImportPage } from './Import';
import { StatsTab } from './Groups';

const TABS = [
  ['cartes', 'Cartes'],
  ['import', 'Import'],
  ['stats', 'Statistiques'],
  ['fiches', 'Fiches de connexion'],
] as const;
type Tab = (typeof TABS)[number][0];

export function Flashcards() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('onglet') as Tab) || 'cartes';
  const groups = useLiveQuery(
    async () => (await db.groups.filter((g) => !g.archived).toArray()).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })),
    [],
    [],
  );
  const gid = params.get('classe') ?? groups[0]?.id;

  const ClassPicker = () => (
    <div className="row" style={{ gap: 4 }}>
      {groups.map((g) => (
        <button
          key={g.id}
          className={'chip' + (g.id === gid ? '' : ' off')}
          style={{ background: g.color ?? 'var(--paper)' }}
          onClick={() => setParams({ onglet: tab, classe: g.id }, { replace: true })}
        >
          {g.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="page stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>
          Flashcards
        </h1>
        <nav className="nav" style={{ flex: 'none' }}>
          {TABS.map(([k, l]) => (
            <a key={k} href="#" className={tab === k ? 'active' : ''} onClick={(e) => (e.preventDefault(), setParams({ onglet: k }, { replace: true }))}>
              {l}
            </a>
          ))}
        </nav>
      </div>
      {tab === 'cartes' && <Cards embedded />}
      {tab === 'import' && <ImportPage embedded />}
      {tab === 'stats' && (
        <div className="stack">
          <ClassPicker />
          {gid && <StatsTab key={gid} groupId={gid} />}
        </div>
      )}
      {tab === 'fiches' && (
        <div className="panel stack">
          <span className="muted">Fiches à découper et à distribuer : identifiant et mot de passe de chaque élève pour se connecter à FoxBox.</span>
          <div className="row" style={{ gap: 6 }}>
            {groups.map((g) => (
              <Link key={g.id} to={`/prof/classes/${g.id}/fiches`} className="btn" style={{ background: g.color ?? 'var(--paper)' }}>
                🖨 {g.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
