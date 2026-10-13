// Fiche élève (professeur) : ses évaluations, et le suivi des messages envoyés aux parents.
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Student } from '../lib/db';
import { score, dateFor } from '../lib/grading';
import { frDate } from '../lib/dates';

export function useStudentEvals(studentId: string) {
  return useLiveQuery(async () => {
    const rs = await db.results.where('studentId').equals(studentId).toArray();
    const evs = await db.evaluations.bulkGet(rs.map((r) => r.evaluationId));
    const myGroups = new Set((await db.memberships.where('studentId').equals(studentId).toArray()).map((m) => m.groupId));
    return rs
      .map((r, i) => ({ r, ev: evs[i], date: evs[i] ? dateFor(evs[i]!, evs[i]!.groupIds.find((g) => myGroups.has(g))) : '' }))
      .filter((x) => x.ev && !x.ev.template)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [studentId], []);
}

export function StudentEvaluations({ student }: { student: Student }) {
  const list = useStudentEvals(student.id);
  return (
    <div className="panel stack">
      <h3 style={{ margin: 0 }}>📋 Évaluations</h3>
      {!list.length && <span className="muted small">Aucune évaluation corrigée pour l'instant.</span>}
      <table className="list">
        <tbody>
          {list.map(({ r, ev, date }) => {
            const s = score(ev!, r);
            const failed = ev!.criteria.filter((c) => {
              const l = r.levels[c.id];
              return l !== null && l !== undefined && l <= 0.25;
            });
            return (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }} className="small muted">
                  {frDate(date)}
                </td>
                <td>
                  <Link to={`/prof/correction/${ev!.id}?onglet=copies&eleve=${student.id}`}>
                    <b>{ev!.name}</b>
                  </Link>
                  {failed.length > 0 && (
                    <div className="small muted" title={failed.map((c) => c.label).join('\n')}>
                      {failed.length} critère(s) raté(s)
                    </div>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 900 }}>{r.absent ? 'Absent' : s ? `${s.note20}/20` : '—'}</td>
                <td className="small muted">{r.appreciation}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
