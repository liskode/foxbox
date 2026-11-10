// Réglage des couleurs de réussite de la grille : 6 couleurs pour les moyennes, 4 pour les cases élève × critère, et leurs seuils.
import { Fragment } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { DEFAULT_GRADE_COLORS, type GradeColors } from '../lib/gradeColors';

export function useGradeColors(): GradeColors {
  const { session } = useAuth();
  return useLiveQuery(async () => (await db.teachers.get(session!.id))?.gradeColors ?? DEFAULT_GRADE_COLORS, [session?.id], DEFAULT_GRADE_COLORS);
}

function Scale({ colors, thresholds, onChange, labels }: { colors: string[]; thresholds: number[]; labels?: string[]; onChange: (colors: string[], thresholds: number[]) => void }) {
  return (
    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
      {colors.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <label className="row small" style={{ gap: 2 }} title="Seuil (en %)">
              <input
                type="number"
                min={0}
                max={100}
                value={thresholds[i - 1]}
                style={{ width: 54 }}
                onChange={(e) => onChange(colors, thresholds.map((t, j) => (j === i - 1 ? Math.max(0, Math.min(100, Number(e.target.value) || 0)) : t)))}
              />
              %
            </label>
          )}
          <label className="stack" style={{ alignItems: 'center', gap: 0 }} title={labels?.[i]}>
            <input type="color" value={c} onChange={(e) => onChange(colors.map((x, j) => (j === i ? e.target.value : x)), thresholds)} style={{ width: 36, height: 26, padding: 0, border: '1px solid var(--muted-line)', borderRadius: 6 }} />
            {labels && <span className="small muted">{labels[i]}</span>}
          </label>
        </Fragment>
      ))}
    </div>
  );
}

export function GradeColorsEditor() {
  const { session } = useAuth();
  const cur = useGradeColors();
  const save = (next: GradeColors) => db.teachers.update(session!.id, { gradeColors: next });
  return (
    <details className="small">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Couleurs et seuils de réussite</summary>
      <div className="stack" style={{ gap: 10, marginTop: 8 }}>
        <div className="stack" style={{ gap: 4 }}>
          <b>Moyennes et notes (moyenne d'un critère, d'une classe, note d'un élève, compétences)</b>
          <Scale colors={cur.overall.colors} thresholds={cur.overall.thresholds} onChange={(colors, thresholds) => save({ ...cur, overall: { colors, thresholds } })} />
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <b>Case d'un élève pour un critère (catégories 1 2 3 4)</b>
          <Scale
            colors={cur.levels.colors}
            thresholds={cur.levels.thresholds}
            labels={['1', '2', '3', '4']}
            onChange={(colors, thresholds) => save({ ...cur, levels: { colors, thresholds } })}
          />
          <span className="muted">Les seuils servent aussi aux valeurs saisies librement (ex. 35 %).</span>
        </div>
        <button className="btn small ghost" style={{ alignSelf: 'flex-start' }} onClick={() => save(DEFAULT_GRADE_COLORS)}>
          Couleurs par défaut
        </button>
      </div>
    </details>
  );
}
