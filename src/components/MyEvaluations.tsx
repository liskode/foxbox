// Espace élève : ses évaluations, selon ce que le professeur a choisi de montrer.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { frDate } from '../lib/dates';
import { levelColor } from '../lib/grading';
import { CompetenceHisto } from './CompetenceHisto';
import { EvalFeedback } from './EvalFeedback';
import { Icon } from './Icon';
import { SelfCheckPanel } from './SelfCheck';

export function MyEvaluations({ studentId }: { studentId: string }) {
  const list = useLiveQuery(
    async () => (await db.resultShares.where('studentId').equals(studentId).toArray()).sort((a, b) => b.date.localeCompare(a.date)),
    [studentId],
    [],
  );
  // Vocaux du professeur pas encore écoutés, par évaluation
  const fresh = useLiveQuery(
    async () => {
      const ms = (await db.messages.where('studentId').equals(studentId).toArray()).filter((m) => m.evaluationId);
      const heard = new Set(ms.filter((m) => m.heardOf).map((m) => m.heardOf));
      const n = new Map<string, number>();
      for (const m of ms)
        if (m.authorId !== studentId && !heard.has(m.id) && m.attachments.some((a) => a.type.startsWith('audio/'))) n.set(m.evaluationId!, (n.get(m.evaluationId!) ?? 0) + 1);
      return n;
    },
    [studentId],
    new Map<string, number>(),
  );
  const student = useLiveQuery(() => db.students.get(studentId), [studentId]);
  // Autocorrections : tant qu'elle n'est pas terminée, la correction du professeur reste cachée
  const checks = useLiveQuery(
    async () => new Map((await db.selfChecks.where('studentId').equals(studentId).toArray()).map((c) => [c.id, c])),
    [studentId],
    new Map(),
  );
  if (!list.length) return <div className="notice">Aucune note pour l'instant.</div>;
  return (
    <div className="panel stack">
      <span className="small muted">Clique sur une évaluation pour voir le détail.</span>
      {list.map((s, i) => {
        const sc = checks.get(s.id);
        const hidden = !!s.selfCheck && !sc?.doneAt; // autocorrection à faire d'abord
        return (
        <details key={s.id} open={i === 0} className="stack" style={{ borderTop: '1px solid var(--muted-line)', paddingTop: 8 }}>
          <summary style={{ cursor: 'pointer' }}>
            <span className="spread" style={{ display: 'inline-flex', width: 'calc(100% - 20px)' }}>
              <span>
                <b>{s.name}</b> <span className="small muted">· {frDate(s.date)}</span>{' '}
                {hidden && <span className="tag warn">à autocorriger</span>}{' '}
                {!hidden && (fresh.get(s.evaluationId) ?? 0) > 0 && (
                  <span className="tag warn">
                    <Icon name="mic" size={13} /> message vocal à écouter
                  </span>
                )}
              </span>
              <b>{s.absent ? 'Absent' : !hidden && s.note20 !== undefined ? `${s.note20}/20` : ''}</b>
            </span>
          </summary>
          {s.selfCheck && (
            <div style={{ margin: '8px 0' }}>
              <SelfCheckPanel share={s} sc={sc} />
            </div>
          )}
          {!hidden && (
          <>
          {s.competences?.length ? (
            <div style={{ margin: '8px 0' }}>
              <CompetenceHisto bars={s.competences.map(({ note, total, ...c }) => ({ c, note, total }))} />
            </div>
          ) : null}
          {s.appreciation && <div style={{ fontStyle: 'italic', margin: '6px 0' }}>« {s.appreciation} »</div>}
          <div style={{ margin: '8px 0' }}>
            <EvalFeedback evaluationId={s.evaluationId} teacherId={s.teacherId} studentId={studentId} me={{ id: studentId, name: student?.firstName ?? 'Élève' }} role="eleve" />
          </div>
          {s.detail && !s.selfCheck && (
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
          </>
          )}
        </details>
        );
      })}
    </div>
  );
}
