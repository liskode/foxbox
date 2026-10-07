import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Rule } from '../../lib/db';
import { StudentReport } from '../../components/StudentReport';
import { DEFAULT_GOAL } from '../../lib/leitner';

export function StudentPage() {
  const { id } = useParams();
  const student = useLiveQuery(async () => (await db.students.get(id!)) ?? null, [id]);
  const groups = useLiveQuery(async () => {
    const ms = await db.memberships.where('studentId').equals(id!).toArray();
    return (await db.groups.bulkGet(ms.map((m) => m.groupId))).filter(Boolean).map((g) => g!);
  }, [id], []);
  if (student === undefined) return null;
  if (!student) return <div className="page muted">Élève introuvable.</div>;
  const subjects = [...new Set(groups.map((g) => g.subject))];

  return (
    <div className="page stack">
      <div className="spread">
        <div>
          <a href="#" className="small muted" onClick={(e) => (e.preventDefault(), history.back())}>
            ← Retour
          </a>
          <h1 className="title" style={{ margin: 0 }}>
            {student.firstName} {student.lastName}
          </h1>
          <div className="muted">
            {groups.map((g) => `${g.name} (${g.subject})`).join(' · ')} · identifiant <span className="code">{student.login}</span>
          </div>
        </div>
        <div className="panel row" style={{ padding: '10px 14px' }}>
          {subjects.map((s) => (
            <label key={s} className="field">
              Objectif / jour{subjects.length > 1 ? ` (${s})` : ''}
              <input
                type="number"
                min={1}
                style={{ width: 80 }}
                value={student.goals[s] ?? DEFAULT_GOAL}
                onChange={(e) => db.students.update(student.id, { goals: { ...student.goals, [s]: Math.max(1, Number(e.target.value)) } })}
              />
            </label>
          ))}
          <label className="field">
            Règle d'erreur
            <select value={student.rule} onChange={(e) => db.students.update(student.id, { rule: e.target.value as Rule })}>
              <option value="strict">Stricte (retour boîte 1)</option>
              <option value="douce">Douce (−1 boîte)</option>
            </select>
          </label>
        </div>
      </div>
      <StudentReport studentId={student.id} teacherView />
    </div>
  );
}
