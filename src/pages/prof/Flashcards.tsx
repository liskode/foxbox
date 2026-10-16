// Flashcards : liste (recherche, création) et import. Les statistiques sont dans chaque classe (onglet Flashcards).
import { useSearchParams } from 'react-router-dom';
import { Cards } from './Cards';
import { ImportPage } from './Import';
import { TabBar } from '../../components/TabBar';

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
        <TabBar tabs={TABS} current={tab} onChange={(k) => setParams({ onglet: k }, { replace: true })} />
      </div>
      {tab === 'cartes' && <Cards embedded />}
      {tab === 'import' && <ImportPage embedded />}
    </div>
  );
}
