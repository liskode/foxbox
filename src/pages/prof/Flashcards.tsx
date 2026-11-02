// Flashcards : liste (recherche, création), import et, pour l'administrateur de Physifox, flashcards rédigées à valider.
// Les statistiques sont dans chaque classe (onglet Flashcards).
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Cards } from './Cards';
import { ImportPage } from './Import';
import { ValidationTab } from './Physifox';
import { TabBar } from '../../components/TabBar';
import { db } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { usePfAdmin } from '../../lib/physifoxAdmin';

type Tab = 'cartes' | 'validation' | 'import';

export function Flashcards() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('onglet') as Tab) || 'cartes';
  const { session } = useAuth();
  const admin = usePfAdmin(session?.id);
  const pending = useLiveQuery(() => db.cardDrafts.where('status').equals('attente').count(), [], 0);
  const tabs = useMemo(
    () => [['cartes', 'Liste'], ...(admin ? [['validation', pending ? `À valider (${pending})` : 'À valider']] : []), ['import', 'Import']] as [Tab, string][],
    [admin, pending],
  );

  return (
    <div className="page stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>
          Flashcards
        </h1>
        <TabBar tabs={tabs} current={tab} onChange={(k) => setParams({ onglet: k }, { replace: true })} />
      </div>
      {tab === 'cartes' && <Cards embedded />}
      {tab === 'validation' && admin && <ValidationTab />}
      {tab === 'import' && <ImportPage embedded />}
    </div>
  );
}
