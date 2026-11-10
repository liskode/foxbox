// Fiche élève (professeur) : ses évaluations, et le suivi des messages envoyés aux parents.
import { useCompetences } from './CompetencePicker';
import { CompetenceHisto } from './CompetenceHisto';
import { categories, competenceScores, masteryOf, subCompetenceScores, type Competence } from '../lib/competences';
import { absencesOf } from '../lib/absences';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Student } from '../lib/db';
import { unitLabel } from '../lib/units';
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

// Évaluations de l'élève : une ligne par évaluation (date, nom, note, appréciation)
export function StudentEvaluations({ student }: { student: Student }) {
  const list = useStudentEvals(student.id);
  return (
    <div className="panel stack" style={{ gap: 4 }}>
      <h3 className="panel-title"><Icon name="eval" size={16} /> Évaluations</h3>
      {!list.length && <span className="muted small">Aucune évaluation corrigée pour l'instant.</span>}
      {list.map(({ r, ev, date }) => {
        const s = score(ev!, r);
        return (
          <div key={r.id} className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'baseline', borderTop: '1px solid var(--muted-line)', paddingTop: 4 }}>
            <span className="small muted" style={{ whiteSpace: 'nowrap', width: 96 }}>
              {frDate(date)}
            </span>
            <Link to={`/prof/correction/${ev!.id}?onglet=copies&eleve=${student.id}`} style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
              {ev!.name}
            </Link>
            <b style={{ whiteSpace: 'nowrap' }}>{r.absent ? 'Absent' : s ? `${s.note20}/20` : '—'}</b>
            <span className="small muted" style={{ flex: 1 }}>
              {r.appreciation}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Détail des sous-compétences évaluées : niveau (échelle du LSU) et points obtenus
const fr = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');
export function SubCompetenceList({ subs }: { subs: ReturnType<typeof subCompetenceScores> }) {
  if (!subs.length) return null;
  return (
    <table className="list small" style={{ marginTop: 4 }}>
      <tbody>
        {subs.map(({ c, note, total, n, value }) => {
          const m = masteryOf(value);
          return (
            <tr key={c.id}>
              <td style={{ whiteSpace: 'nowrap' }}>
                <span style={{ background: c.color, borderRadius: 5, padding: '0 4px', fontWeight: 800 }}>{c.code}</span>
              </td>
              <td>{c.name}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <span title={m.name} style={{ background: m.color, borderRadius: 6, padding: '1px 6px', fontWeight: 800 }}>
                  {m.code}
                </span>
              </td>
              <td className="muted" style={{ whiteSpace: 'nowrap' }} title={`${n} critère(s) évalué(s)`}>
                {fr(note)}/{fr(total)} pts
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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

// Détail des compétences : RES (séances et séquences à restituer, les moins réussies d'abord) et sous-compétences des autres
export function StudentCompetenceDetail({ student }: { student: Student }) {
  const list = useStudentEvals(student.id);
  const comps = useCompetences();
  const units = useLiveQuery(() => db.units.toArray(), [], []);
  const copies = list.filter(({ r }) => !r.absent).map(({ ev, r }) => ({ ev: ev!, r }));
  const res = new Map<string, { note: number; total: number; n: number }>();
  for (const { ev, r } of copies)
    for (const cr of ev.criteria) {
      const l = r.levels[cr.id];
      if (!cr.competenceIds?.includes('APP') || l === null || l === undefined) continue;
      for (const u of cr.unitIds ?? []) {
        const cur = res.get(u) ?? { note: 0, total: 0, n: 0 };
        cur.note += l * cr.points;
        cur.total += cr.points;
        cur.n++;
        res.set(u, cur);
      }
    }
  const resCat = comps.find((c) => c.id === 'APP');
  const resRows = [...res]
    .map(([id, x]) => ({ u: units.find((u) => u.id === id), ...x, value: x.total ? x.note / x.total : 0 }))
    .sort((a, b) => a.value - b.value);
  const subs = subCompetenceScores(comps, copies);
  if (!resRows.length && !subs.length) return null;
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <h3 className="panel-title"><Icon name="target" size={16} /> Détail des compétences</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 4 }}>
          <b className="small">
            <span style={{ background: resCat?.color, borderRadius: 5, padding: '0 4px' }}>{resCat?.code ?? 'RES'}</span> Points de cours à restituer
          </b>
          {resRows.length ? (
            <table className="list small">
              <tbody>
                {resRows.map(({ u, note, total, n, value }, i) => {
                  const m = masteryOf(value);
                  return (
                    <tr key={u?.id ?? i}>
                      <td>{u ? unitLabel(u) : '(séance supprimée)'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span title={m.name} style={{ background: m.color, borderRadius: 6, padding: '1px 6px', fontWeight: 800 }}>
                          {m.code}
                        </span>
                      </td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }} title={`${n} critère(s) évalué(s)`}>
                        {fr(note)}/{fr(total)} pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <span className="small muted">Aucune séance à restituer indiquée dans les barèmes (critères RES).</span>
          )}
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <b className="small">Autres compétences</b>
          {subs.length ? <SubCompetenceList subs={subs} /> : <span className="small muted">Pas encore de sous-compétence évaluée.</span>}
        </div>
      </div>
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
