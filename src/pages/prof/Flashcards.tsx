// Flashcards : liste (recherche, création) et import. Les statistiques sont dans chaque classe (onglet Flashcards).
import { useSearchParams } from 'react-router-dom';
import { Cards } from './Cards';
import { ImportPage } from './Import';

const TABS = [
  ['cartes', 'Liste'],
  ['import', 'Import'],
] as const;
type Tab = (typeof TABS)[number][0];

export function Flashcards() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('onglet') as Tab) || 'cartes';

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
    </div>
  );
}
