// Évaluations : une colonne par niveau, état de chaque classe (à venir / à corriger / corrigée), modèles.
import { useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SUBJECTS, type Evaluation, type Group } from '../../lib/db';
import { newEvaluation, duplicate, score, stats, levelOfEval } from '../../lib/grading';
import { today } from '../../lib/dates';
import { useAuth } from '../../lib/auth';
import { levelPlans, dm } from '../../lib/forecast';
import { LEVELS, levelColors, levelOfName } from '../../lib/units';

function useGroups() {
  return useLiveQuery(() => db.groups.toArray(), [], []);
}

interface Pill {
  g: Group;
  state: 'todo' | 'grading' | 'done';
  label: string;
  title: string;
}

// Toutes les évaluations, avec l'état de chaque classe : à venir (gris), à corriger (jaune), corrigée (vert)
function useOverview() {
  const { session } = useAuth();
  return useLiveQuery(async () => {
    const [evs, groups, results, ms, plans] = await Promise.all([
      db.evaluations.toArray(),
      db.groups.toArray(),
      db.results.toArray(),
      db.memberships.toArray(),
      levelPlans(session!.id),
    ]);
    const t = today();
    const rows = evs
      .filter((e) => !e.template)
      .map((ev) => {
        const level = levelOfEval(ev, groups);
        const rs = results.filter((r) => r.evaluationId === ev.id);
        const pills: Pill[] = [];
        let first = '9999';
        for (const gid of ev.groupIds) {
          const g = groups.find((x) => x.id === gid);
          if (!g) continue;
          const members = new Set(ms.filter((m) => m.groupId === gid).map((m) => m.studentId));
          const mine = rs.filter((r) => members.has(r.studentId));
          const corrected = mine.filter((r) => r.absent || score(ev, r)).length;
          const notes = mine.map((r) => score(ev, r)?.note20).filter((x): x is number => x !== undefined);
          const planned = ev.unitId ? plans.levels.find((l) => l.level === level)?.plans.get(gid)?.planned.get(ev.unitId) : undefined;
          const date = ev.groupDates?.[gid] ?? planned ?? ev.date;
          first = date < first ? date : first;
          const name = g.name.replace(/_.*/, '');
          if (members.size && corrected >= members.size)
            pills.push({ g, state: 'done', label: `${name} ${stats(notes)?.mean ?? '—'}`, title: `Corrigée · moyenne ${stats(notes)?.mean ?? '—'}/20` });
          else if (corrected || (ev.groupDates?.[gid] ?? (!ev.unitId ? ev.date : '9999')) <= t)
            pills.push({ g, state: 'grading', label: `${name} ${corrected}/${members.size}`, title: `${corrected} copie(s) corrigée(s) sur ${members.size}` });
          else pills.push({ g, state: 'todo', label: `${name} ${dm(date)}`, title: planned ? `Prévue le ${dm(date)} (d'après la Progression)` : `Prévue le ${dm(date)}` });
        }
        return { ev, level, pills, first };
      })
      .sort((a, b) => a.first.localeCompare(b.first) || a.ev.createdAt - b.ev.createdAt);
    return { rows, groups };
  }, [session?.id]);
}

const PILL_STYLE: Record<Pill['state'], React.CSSProperties> = {
  todo: { background: 'transparent', border: '1px dashed var(--muted-line)', color: '#9a968d' },
  grading: { background: '#fff3c4', border: '1px solid #00000033' },
  done: { background: '#bfe5c9', border: '1px solid var(--easy)' },
};

function EvalCard({ ev, pills }: { ev: Evaluation; pills: Pill[] }) {
  return (
    <Link to={`/prof/correction/${ev.id}`} className="btn" style={{ display: 'block', textAlign: 'left', whiteSpace: 'normal', background: 'var(--paper)' }}>
      <div>
        {ev.unitId && '📝 '}
        {ev.name}
      </div>
      <div className="small muted" style={{ fontWeight: 600 }}>
        {ev.criteria.length} critère(s)
      </div>
      <div className="row" style={{ gap: 4, marginTop: 4 }}>
        {pills.map((p) => (
          <span key={p.g.id} className="small" title={p.title} style={{ borderRadius: 6, padding: '0 5px', fontWeight: 700, ...PILL_STYLE[p.state] }}>
            {p.label}
          </span>
        ))}
        {!pills.length && <span className="small muted">Aucune classe</span>}
      </div>
    </Link>
  );
}

export function Correction() {
  const nav = useNavigate();
  const evs = useLiveQuery(() => db.evaluations.toArray(), [], []);
  const groups = useGroups();
  const data = useOverview();
  const { session } = useAuth();
  const colors = useLiveQuery(() => levelColors(session!.id), [session], {} as Record<string, string>);
  const templates = evs.filter((e) => e.template).sort((a, b) => a.name.localeCompare(b.name));
  const rows = data?.rows ?? [];
  const columns = [...LEVELS, ...(rows.some((r) => !r.level) ? [''] : [])];

  async function create(level?: string) {
    const ids = groups.filter((g) => !g.archived && level && levelOfName(g.name) === level).map((g) => g.id);
    const ev = { ...newEvaluation(SUBJECTS[0], ids), level };
    await db.evaluations.put(ev);
    nav(`/prof/correction/${ev.id}?onglet=bareme`);
  }

  async function fromTemplate(t: Evaluation) {
    const ev = duplicate(t);
    await db.evaluations.put(ev);
    nav(`/prof/correction/${ev.id}?onglet=bareme`);
  }

  return (
    <div className="page stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>Évaluations</h1>
        <Link to="/prof/competences" className="btn">
          🎯 Compétences
        </Link>

      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, alignItems: 'start' }}>
        {columns.map((level) => {
          const list = rows.filter((r) => (r.level ?? '') === level);
          return (
            <div key={level || '-'} className="panel stack" style={{ gap: 8, background: colors[level] ?? 'var(--paper)' }}>
              <div className="spread">
                <h2 style={{ margin: 0 }}>{level || 'Sans niveau'}</h2>
                {level && (
                  <button className="btn small" onClick={() => create(level)}>
                    + Évaluation
                  </button>
                )}
              </div>
              {list.map((r) => (
                <EvalCard key={r.ev.id} ev={r.ev} pills={r.pills} />
              ))}
              {!list.length && <span className="small muted">Aucune évaluation.</span>}
            </div>
          );
        })}
      </div>
      <div className="small muted">
        Gris : date prévue · jaune : copies à corriger · vert : corrigée (moyenne). 📝 : évaluation placée dans une séquence de la Progression.
      </div>
      {templates.length > 0 && (
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Modèles</h2>
          <span className="small muted">Une évaluation déjà construite (critères et barème), à réutiliser pour de nouvelles classes.</span>
          <table className="list">
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.name}</b> {t.level && <span className="chip" style={{ background: colors[t.level] }}>{t.level}</span>}
                  </td>
                  <td className="small muted">
                    {t.criteria.length} critères · {Math.round(t.criteria.reduce((a, c) => a + c.points, 0) * 10) / 10} pts
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link className="btn small ghost" to={`/prof/correction/${t.id}?onglet=bareme`}>
                      Modifier
                    </Link>{' '}
                    <button className="btn small primary" onClick={() => fromTemplate(t)}>
                      Utiliser
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {groups.length === 0 && <div className="small muted">Astuce : créez d'abord vos classes dans l'onglet Classes.</div>}
    </div>
  );
}
