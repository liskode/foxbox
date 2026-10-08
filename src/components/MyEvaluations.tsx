// Espace élève : ses évaluations, selon ce que le professeur a choisi de montrer.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { frDate } from '../lib/dates';
import { levelColor } from '../lib/grading';

export function MyEvaluations({ studentId }: { studentId: string }) {
  const list = useLiveQuery(
    async () => (await db.resultShares.where('studentId').equals(studentId).toArray()).sort((a, b) => b.date.localeCompare(a.date)),
    [studentId],
    [],
  );
  if (!list.length) return null;
  return (
    <div className="panel stack">
      <h3 style={{ margin: 0 }}>📋 Mes évaluations</h3>
      {list.map((s) => (
        <details key={s.id} className="stack" style={{ borderTop: '1px solid var(--muted-line)', paddingTop: 8 }}>
          <summary style={{ cursor: s.detail || s.appreciation ? 'pointer' : 'default', listStyle: s.detail || s.appreciation ? undefined : 'none' }}>
            <span className="spread" style={{ display: 'inline-flex', width: 'calc(100% - 20px)' }}>
              <span>
                <b>{s.name}</b> <span className="small muted">· {frDate(s.date)}</span>
              </span>
              <b>{s.absent ? 'Absent' : s.note20 !== undefined ? `${s.note20}/20` : ''}</b>
            </span>
          </summary>
          {s.appreciation && <div style={{ fontStyle: 'italic', margin: '6px 0' }}>« {s.appreciation} »</div>}
          {s.detail && (
            <table className="list" style={{ marginTop: 6 }}>
              <tbody>
                {s.detail.map((d, i) => (
                  <tr key={i} style={{ background: levelColor(d.level) }}>
                    <td>{d.label}</td>
                    <td className="small" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {d.level === null ? '—' : `${Math.round(d.level * d.points * 10) / 10} / ${d.points}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      ))}
    </div>
  );
}
