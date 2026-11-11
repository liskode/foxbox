// Compétences : référentiel (RES, ANA, REA, VAL, COM et sous-compétences) et niveau atteint par les élèves d'une classe.
import { Icon } from '../../components/Icon';
import { ask, confirmBox } from '../../components/Dialog';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, byName, groupStudents, isClass, shortName } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import {
  RECENT,
  categories,
  childrenOf,
  levelFor,
  newSubCompetence,
  observations,
  saveCompetences,
  type Competence,
} from '../../lib/competences';
import { CompetenceChip, useCompetences } from '../../components/CompetencePicker';
import { StudentName } from '../../components/Avatar';
import { useGradeColors } from '../../components/GradeColorsEditor';
import { levelCategory, levelCellColor, type GradeColors } from '../../lib/gradeColors';

// Niveau d'un élève : pourcentage arrondi, aux couleurs des « critères de réussite » (Réglages › Évaluations)
export function MasteryCell({ lv, gc }: { lv: ReturnType<typeof levelFor>; gc: GradeColors }) {
  if (!lv) return <span className="muted small">—</span>;
  return (
    <span
      title={`${lv.mastery.name} · ${lv.evals} évaluation(s), ${lv.n} critère(s) ; niveau retenu : ${RECENT} plus récentes`}
      style={{ background: levelCellColor(lv.value, gc), borderRadius: 6, padding: '1px 6px', fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
    >
      {Math.round(lv.value * 100)} %
    </span>
  );
}

function Referential({ list, selected, onSelect }: { list: Competence[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const { session } = useAuth();
  const save = (l: Competence[]) => saveCompetences(session!.id, l);
  return (
    <div className="panel stack" style={{ gap: 6 }}>
      <h3 style={{ margin: 0 }}>Référentiel</h3>
      <button className={'btn small' + (selected ? ' ghost' : ' primary')} onClick={() => onSelect(null)}>
        Les 5 catégories
      </button>
      {categories(list).map((cat) => (
        <div key={cat.id} className="stack" style={{ gap: 3 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <CompetenceChip c={cat} />
            <button
              className={'btn small' + (selected === cat.id ? ' primary' : ' ghost')}
              style={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
              onClick={() => onSelect(cat.id)}
              title="Voir le détail de cette catégorie"
            >
              {cat.name}
            </button>
            <button
              className="btn small ghost"
              title="Ajouter une sous-compétence"
              onClick={async () => {
                const name = await ask(`Nouvelle sous-compétence de ${cat.code} (${cat.name})`, { label: 'Intitulé' });
                if (name?.trim()) save([...list, newSubCompetence(list, cat, name.trim())]);
              }}
            >
              +
            </button>
          </div>
          {childrenOf(list, cat.id).map((k, i) => (
            <div
              key={k.id}
              className="row small"
              style={{ gap: 6, marginLeft: 22, paddingTop: 3, flexWrap: 'nowrap', borderTop: i ? '1px solid var(--soft-line)' : undefined }}
            >
              <CompetenceChip c={k} small />
              <span style={{ flex: 1, cursor: 'pointer' }} title="Cliquer pour renommer" onClick={async () => {
                const name = await ask('Renommer la sous-compétence', { label: 'Intitulé', value: k.name });
                if (name?.trim()) save(list.map((x) => (x.id === k.id ? { ...x, name: name.trim() } : x)));
              }}>
                {k.name}
              </span>
              <button
                className="btn small ghost"
                style={{ padding: '0 6px' }}
                title="Supprimer"
                onClick={async () => (await confirmBox(`Supprimer « ${k.code} ${k.name} » ? Les critères qui l'utilisent ne seront plus rattachés.`)) && save(list.filter((x) => x.id !== k.id))}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      ))}
      <span className="small muted">« + » ajoute une sous-compétence ; cliquez sur son nom pour le modifier.</span>
    </div>
  );
}

export function Competences() {
  const list = useCompetences();
  const gc = useGradeColors();
  const [params, setParams] = useSearchParams();
  const groups = useLiveQuery(
    async () => (await db.groups.filter((g) => !g.archived && isClass(g)).toArray()).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })),
    [],
    [],
  );
  const gid = params.get('classe') ?? groups[0]?.id;
  const selected = params.get('c');
  const set = (p: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(p)) if (v) next.set(k, v);
      else next.delete(k);
    setParams(next, { replace: true });
  };

  const data = useLiveQuery(async () => {
    if (!gid) return null;
    const students = (await groupStudents(gid)).sort(byName);
    return { students, obs: await observations([gid]) };
  }, [gid]);

  const cat = list.find((c) => c.id === selected);
  // Colonnes : les 5 catégories, ou une catégorie et ses sous-compétences
  // (sous-compétences : seulement celles déjà évaluées dans la classe)
  const seen = new Set(data?.obs.map((o) => o.competenceId));
  const cols = cat ? [cat, ...childrenOf(list, cat.id).filter((k) => seen.has(k.id))] : categories(list);
  const ids = new Set(cols.flatMap((c) => [c.id, ...childrenOf(list, c.id).map((k) => k.id)]));
  const evals = data ? [...new Map(data.obs.filter((o) => ids.has(o.competenceId)).map((o) => [o.evaluation.id, o.evaluation])).values()] : [];

  return (
    <div className="page stack">
      <div className="spread">
        <div>
          <Link to="/prof/correction" className="small muted">
            ← Évaluations
          </Link>
          <h1 className="title" style={{ margin: 0 }}>
            Compétences
          </h1>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {groups.map((g) => (
            <button key={g.id} className={'chip cchip' + (g.id === gid ? '' : ' off')} style={{ background: g.color ?? 'var(--paper)' }} onClick={() => set({ classe: g.id })}>
              {shortName(g.name)}
            </button>
          ))}
        </div>
      </div>
      <div className="stack-phone" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 420px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <Referential list={list} selected={selected} onSelect={(id) => set({ c: id })} />
        <div className="stack">
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table className="list" style={{ width: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', minWidth: 220 }}>Élève</th>
                  {/* colonnes étroites : l'intitulé est dans le référentiel à gauche (et au survol) */}
                  {cols.map((c) => (
                    <th key={c.id} style={{ textAlign: 'center', width: 64 }} title={c.parentId || !cat ? c.name : `${c.name} (ensemble)`}>
                      <CompetenceChip c={c} onClick={!c.parentId && !cat ? () => set({ c: c.id }) : undefined} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/prof/eleves/${s.id}?classe=${gid}`} style={{ color: 'inherit' }}>
                        <StudentName student={s} />
                      </Link>
                    </td>
                    {cols.map((c) => (
                      <td key={c.id} style={{ textAlign: 'center' }}>
                        <MasteryCell lv={levelFor(list, data.obs, s.id, c.id)} gc={gc} />
                      </td>
                    ))}
                  </tr>
                ))}
                {data && data.students.length > 0 && (
                  <tr>
                    <td>
                      <b>Classe</b>
                      <div className="small muted">part des élèves à {gc.levels.thresholds[1]} % ou plus</div>
                    </td>
                    {cols.map((c) => {
                      const lvs = data.students.map((s) => levelFor(list, data.obs, s.id, c.id)).filter((x) => !!x);
                      const ok = lvs.filter((l) => levelCategory(l!.value, gc) >= 2).length;
                      return (
                        <td key={c.id} style={{ textAlign: 'center', fontWeight: 800 }} title={lvs.length ? `${ok} élève(s) sur ${lvs.length} évalué(s)` : undefined}>
                          {lvs.length ? `${Math.round((ok / lvs.length) * 100)} %` : <span className="muted small">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
            {data && !data.students.length && <span className="muted">Aucun élève dans cette classe.</span>}
          </div>
          <div className="row small" style={{ gap: 8 }}>
            {gc.levels.colors.map((color, i) => (
              <span key={i}>
                <span style={{ background: color, borderRadius: 6, padding: '0 6px', fontWeight: 800 }}>{i + 1}</span>{' '}
                {i === 0 ? `moins de ${gc.levels.thresholds[0]} %` : i === 3 ? `${gc.levels.thresholds[2]} % et plus` : `${gc.levels.thresholds[i - 1]} à ${gc.levels.thresholds[i]} %`}
              </span>
            ))}
            <span className="muted">· seuils et couleurs réglables dans Réglages › Évaluations</span>
          </div>
          <div className="panel stack" style={{ gap: 6 }}>
            <h3 style={{ margin: 0 }}>Évaluations qui mobilisent {cat ? `${cat.code} – ${cat.name}` : 'ces compétences'}</h3>
            {evals.map((e) => (
              <div key={e.id} className="row" style={{ gap: 8 }}>
                <Link to={`/prof/correction/${e.id}?onglet=bareme`} style={{ fontWeight: 800 }}>
                  {e.name}
                </Link>
                {e.criteria
                  .filter((c) => c.competenceIds?.some((k) => ids.has(k)))
                  .map((c) => (
                    <span key={c.id} className="small muted">
                      · {c.label}
                    </span>
                  ))}
              </div>
            ))}
            {!evals.length && (
              <span className="small muted">
                Aucune pour l'instant : dans le barème d'une évaluation, cliquez sur les pastilles RES, ANA, REA, VAL, COM sous chaque critère.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
