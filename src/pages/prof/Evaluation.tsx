// Une évaluation : barème, correction copie par copie, grille, résultats.
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Evaluation, type Student } from '../../lib/db';
import { maxPoints } from '../../lib/grading';

import { BaremeTab } from './evaluation/Bareme';
import { CopiesTab } from './evaluation/Copies';
import { GrilleTab } from './evaluation/Grille';
import { ResultatsTab } from './evaluation/Resultats';
import { TabBar } from '../../components/TabBar';
import { useAccess } from '../../lib/access';
import { ReadOnlyNote, ReadOnlyZone } from '../../components/ReadOnly';

// ---------------------------------------------------------------- Page
export function EvaluationPage() {
  const { id } = useParams();
  const ev = useLiveQuery(async () => (await db.evaluations.get(id!)) ?? null, [id]);
  const [params, setParams] = useSearchParams();
  type Tab = 'bareme' | 'copies' | 'grille' | 'resultats';
  const tab = (params.get('onglet') as Tab) || 'copies';
  const access = useAccess();
  if (ev === undefined) return null;
  if (!ev) return <div className="page muted">Évaluation introuvable.</div>;
  const update = async (p: Partial<Evaluation>) => {
    await db.evaluations.put({ ...ev, ...p });
  };
  const tabs: [Tab, string][] = ev.template
    ? [['bareme', 'Barème']]
    : [
        ['bareme', 'Barème et réglages'],
        ['copies', 'Copie par copie'],
        ['grille', 'Grille'],
        ['resultats', 'Résultats'],
      ];
  // Co-enseignement : évaluation d'un collègue en lecture seule (pas de saisie copie par copie)
  const ro = !access.canEditEval(ev);
  const copiesAt = tabs.findIndex(([k]) => k === 'copies');
  if (ro && copiesAt >= 0) tabs.splice(copiesAt, 1);
  const current = ev.template ? 'bareme' : ro && tab === 'copies' ? 'grille' : tab;

  return (
    <div className={'page stack' + (current === 'grille' ? ' wide' : '')}>
      <div className="spread">
        <div>
          <Link to="/prof/correction" className="small muted">
            ← Évaluations
          </Link>
          <h1 className="title" style={{ margin: 0 }}>
            {ev.name}
            {ev.template && (
              <span className="chip" style={{ fontFamily: 'var(--font)', marginLeft: 8, verticalAlign: 'middle' }}>
                modèle
              </span>
            )}
          </h1>
          <div className="muted small">
            {ev.criteria.length} critère(s) · {maxPoints(ev)} point(s)
          </div>
        </div>
        <TabBar tabs={tabs} current={current} onChange={(k) => setParams({ onglet: k }, { replace: true })} />
      </div>
      {ro && <ReadOnlyNote ownerId={ev.ownerId} what="Évaluation" />}
      <ReadOnlyZone readOnly={ro} className="stack">
        {current === 'bareme' && <BaremeTab ev={ev} update={update} />}
        {current === 'grille' && <GrilleTab ev={ev} />}
      </ReadOnlyZone>
      {current === 'copies' && <CopiesTab ev={ev} />}
      {current === 'resultats' && <ResultatsTab ev={ev} />}
    </div>
  );
}

export type { Student };
