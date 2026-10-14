// Fiche élève (professeur) : ses évaluations, et le suivi des messages envoyés aux parents.
import { useCompetences } from './CompetencePicker';
import { CompetenceHisto } from './CompetenceHisto';
import { categories, competenceScores, type Competence } from '../lib/competences';
import { absencesOf } from '../lib/absences';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Student } from '../lib/db';
import { score, dateFor } from '../lib/grading';
import { frDate } from '../lib/dates';
import { Icon } from './Icon';

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
      <h3 className="panel-title"><Icon name="eval" size={16} /> Évaluations</h3>
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

// Compétences de l'élève sur toutes ses évaluations : histogramme (hauteur = points du barème, vert = réussi)
export function StudentCompetenceHisto({ student }: { student: Student }) {
  const list = useStudentEvals(student.id);
  const comps = useCompetences();
  const sums = new Map<string, { c: Competence; note: number; total: number }>();
  for (const { ev, r } of list) {
    for (const sc of competenceScores(comps, ev!, r)) {
      const cur = sums.get(sc.c.id) ?? { c: sc.c, note: 0, total: 0 };
      cur.note += sc.note;
      cur.total += sc.total;
      sums.set(sc.c.id, cur);
    }
  }
  const bars = categories(comps)
    .map((c) => sums.get(c.id))
    .filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <div className="spread">
        <h3 className="panel-title"><Icon name="target" size={16} /> Compétences</h3>
        <Link to="/prof/competences" className="small">
          détail →
        </Link>
      </div>
      {bars.length ? (
        <>
          <CompetenceHisto bars={bars} height={110} />
          <span className="small muted">Toutes évaluations confondues · hauteur : points du barème · vert : réussi.</span>
        </>
      ) : (
        <span className="muted small">Pas encore de critère rattaché à une compétence.</span>
      )}
    </div>
  );
}

// Absences relevées à l'appel : date, séance du jour, motif (note libre)
export function StudentAbsences({ student }: { student: Student }) {
  const list = useLiveQuery(() => absencesOf(student.id), [student.id], []);
  return (
    <div className="panel stack" style={{ gap: 6 }}>
      <h3 className="panel-title"><Icon name="door" size={16} /> Absences ({list.length})</h3>
      {list.length ? (
        <table className="list">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Séance</th>
              <th style={{ textAlign: 'left' }}>Motif</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>
                  {frDate(a.date)}
                </td>
                <td className="small">{a.seance || <span className="muted">— (aucune séance cochée ce jour-là)</span>}</td>
                <td style={{ width: '40%' }}>
                  <input
                    defaultValue={a.reason ?? ''}
                    placeholder="motif, justificatif…"
                    onBlur={(e) => e.target.value !== (a.reason ?? '') && db.absences.update(a.id, { reason: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </td>
                <td>
                  <button className="btn small ghost" title="Supprimer cette absence" onClick={() => confirm('Supprimer cette absence ?') && db.absences.delete(a.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <span className="muted small">Aucune absence relevée. L'appel se fait sur le plan de classe (bouton « Faire l'appel » de la classe).</span>
      )}
    </div>
  );
}
