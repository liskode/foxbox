// Une évaluation : barème, correction copie par copie, grille, résultats.
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Evaluation, type Student } from '../../lib/db';
import { maxPoints } from '../../lib/grading';

import { BaremeTab } from './evaluation/Bareme';
import { CopiesTab } from './evaluation/Copies';
import { GrilleTab } from './evaluation/Grille';
import { ResultatsTab } from './evaluation/Resultats';

// ---------------------------------------------------------------- Page
export function EvaluationPage() {
  const { id } = useParams();
  const ev = useLiveQuery(async () => (await db.evaluations.get(id!)) ?? null, [id]);
  const [params, setParams] = useSearchParams();
  type Tab = 'bareme' | 'copies' | 'grille' | 'resultats';
  const tab = (params.get('onglet') as Tab) || 'copies';
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
  const current = ev.template ? 'bareme' : tab;

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
        <nav className="nav" style={{ flex: 'none' }}>
          {tabs.map(([k, l]) => (
            <a
              key={k}
              href="#"
              className={current === k ? 'active' : ''}
              onClick={(e) => (e.preventDefault(), setParams({ onglet: k }, { replace: true }))}
            >
              {l}
            </a>
          ))}
        </nav>
      </div>
      {current === 'bareme' && <BaremeTab ev={ev} update={update} />}
      {current === 'copies' && <CopiesTab ev={ev} />}
      {current === 'grille' && <GrilleTab ev={ev} />}
      {current === 'resultats' && <ResultatsTab ev={ev} />}
    </div>
  );
}

export type { Student };
