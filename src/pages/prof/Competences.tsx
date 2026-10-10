// Compétences : référentiel (APP, ANA, REA, VAL, COM et sous-compétences) et niveau atteint par les élèves d'une classe.
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Student } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import {
  MASTERY,
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

export function MasteryCell({ lv }: { lv: ReturnType<typeof levelFor> }) {
  if (!lv) return <span className="muted small">—</span>;
  return (
    <span
      title={`${lv.mastery.name} · ${Math.round(lv.value * 100)} % (${lv.evals} évaluation(s), ${lv.n} critère(s) ; niveau retenu : ${RECENT} plus récentes)`}
      style={{ background: lv.mastery.color, borderRadius: 6, padding: '1px 6px', fontWeight: 800, fontSize: '0.8rem' }}
    >
      {lv.mastery.code}
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
              style={{ flex: 1, justifyContent: 'flex-start' }}
              onClick={() => onSelect(cat.id)}
              title="Voir le détail de cette catégorie"
            >
              {cat.name}
            </button>
            <button
              className="btn small ghost"
              title="Ajouter une sous-compétence"
              onClick={() => {
                const name = prompt(`Nouvelle sous-compétence de ${cat.code} (${cat.name}) :`);
                if (name?.trim()) save([...list, newSubCompetence(list, cat, name.trim())]);
              }}
            >
              +
            </button>
          </div>
          {childrenOf(list, cat.id).map((k) => (
            <div key={k.id} className="row small" style={{ gap: 6, paddingLeft: 22, flexWrap: 'nowrap' }}>
              <CompetenceChip c={k} small />
              <span style={{ flex: 1, cursor: 'pointer' }} title="Cliquer pour renommer" onClick={() => {
                const name = prompt('Nom de la sous-compétence', k.name);
                if (name?.trim()) save(list.map((x) => (x.id === k.id ? { ...x, name: name.trim() } : x)));
              }}>
                {k.name}
              </span>
              <button
                className="btn small ghost"
                style={{ padding: '0 6px' }}
                title="Supprimer"
                onClick={() => confirm(`Supprimer « ${k.code} ${k.name} » ? Les critères qui l'utilisent ne seront plus rattachés.`) && save(list.filter((x) => x.id !== k.id))}
              >
                ✕
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
  const [params, setParams] = useSearchParams();
  const groups = useLiveQuery(
    async () => (await db.groups.filter((g) => !g.archived).toArray()).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })),
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
    const ms = await db.memberships.where('groupId').equals(gid).toArray();
    const students = ((await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[]).sort(
      (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
    );
    return { students, obs: await observations([gid]) };
  }, [gid]);

  const cat = list.find((c) => c.id === selected);
  // Colonnes : les 5 catégories, ou une catégorie et ses sous-compétences
  const cols = cat ? [cat, ...childrenOf(list, cat.id)] : categories(list);
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
            <button key={g.id} className={'chip' + (g.id === gid ? '' : ' off')} style={{ background: g.color ?? 'var(--paper)' }} onClick={() => set({ classe: g.id })}>
              {g.name}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 18, alignItems: 'start' }}>
        <Referential list={list} selected={selected} onSelect={(id) => set({ c: id })} />
        <div className="stack">
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table className="list">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Élève</th>
                  {cols.map((c) => (
                    <th key={c.id} style={{ textAlign: 'center' }}>
                      <CompetenceChip c={c} onClick={!c.parentId && !cat ? () => set({ c: c.id }) : undefined} />
                      <div className="small muted" style={{ fontWeight: 600 }}>
                        {c.parentId ? c.name : cat ? 'ensemble' : c.name}
                      </div>
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
                        <MasteryCell lv={levelFor(list, data.obs, s.id, c.id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data && !data.students.length && <span className="muted">Aucun élève dans cette classe.</span>}
          </div>
          <div className="row small" style={{ gap: 8 }}>
            {MASTERY.map((m) => (
              <span key={m.code}>
                <span style={{ background: m.color, borderRadius: 6, padding: '0 6px', fontWeight: 800 }}>{m.code}</span> {m.name}
              </span>
            ))}
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
                Aucune pour l'instant : dans le barème d'une évaluation, cliquez sur les pastilles APP, ANA, REA, VAL, COM sous chaque critère.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Fiche élève : niveau atteint pour chaque compétence (toutes classes confondues)
export function StudentCompetences({ student }: { student: Student }) {
  const list = useCompetences();
  const obs = useLiveQuery(async () => (await observations()).filter((o) => o.studentId === student.id), [student.id]);
  if (!obs?.length) return null;
  return (
    <div className="panel stack" style={{ gap: 6 }}>
      <div className="spread">
        <h2 style={{ margin: 0 }}>Compétences</h2>
        <Link to="/prof/competences" className="btn small ghost">
          Voir la classe
        </Link>
      </div>
      {categories(list).map((cat) => {
        const lv = levelFor(list, obs, student.id, cat.id);
        return (
          <div key={cat.id} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <CompetenceChip c={cat} />
            <span style={{ width: 110 }}>{cat.name}</span>
            <div style={{ flex: 1, maxWidth: 260, height: 12, border: '2px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--paper)' }}>
              {lv && <div style={{ width: `${lv.value * 100}%`, height: '100%', background: lv.mastery.color }} />}
            </div>
            <MasteryCell lv={lv} />
            {childrenOf(list, cat.id).map((k) => {
              const l = levelFor(list, obs, student.id, k.id);
              return l ? (
                <span key={k.id} className="small" title={k.name}>
                  {k.code} <MasteryCell lv={l} />
                </span>
              ) : null;
            })}
          </div>
        );
      })}
    </div>
  );
}
