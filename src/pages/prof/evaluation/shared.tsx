// Évaluation : outils communs aux onglets (niveaux saisis, résultats, pastilles).
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Evaluation, type Result, shortName } from '../../../lib/db';
import { round1, score, studentsOf } from '../../../lib/grading';
import { FlagBadges, useAllFlags } from '../../../components/StudentNote';
import { useCompetences } from '../../../components/CompetencePicker';
import { competenceScores, evalCategories } from '../../../lib/competences';
import { CompetenceHisto } from '../../../components/CompetenceHisto';

export const pct = (l: number | null | undefined) => (l === null || l === undefined ? '' : `${Math.round(l * 100)}`);
export const isTyping = (t: EventTarget | null) => /INPUT|TEXTAREA|SELECT/.test((t as HTMLElement)?.tagName ?? '');

export function parseLevel(s: string): number | null | undefined {
  const t = s.trim().replace(',', '.').replace('%', '');
  if (!t) return null;
  let v = parseFloat(t);
  if (Number.isNaN(v)) return undefined;
  if (v > 1) v = v / 100; // « 20 » ou « 20% » = 0,2
  return Math.max(0, Math.min(1, round1(v * 100) / 100));
}

// ---------------------------------------------------------------- Correction copie par copie
export function useResults(ev: Evaluation) {
  const list = useLiveQuery(() => studentsOf(ev), [ev.groupIds.join()], []);
  const results = useLiveQuery(
    async () => new Map((await db.results.where('evaluationId').equals(ev.id).toArray()).map((r) => [r.studentId, r])),
    [ev.id],
    new Map<string, Result>(),
  );
  return { list, results };
}

export function NoteBadge({ ev, r }: { ev: Evaluation; r?: Result }) {
  const s = score(ev, r);
  if (r?.absent) return <span className="chip">Absent</span>;
  if (!s) return <span className="muted small">—</span>;
  return (
    <span style={{ fontWeight: 900 }}>
      {s.note}/{s.total} <span className="muted small">· {s.note20}/20</span>
    </span>
  );
}

export function CompetenceBadges({ ev, r, small }: { ev: Evaluation; r?: Result; small?: boolean }) {
  const list = useCompetences();
  const scores = competenceScores(list, ev, r);
  if (!scores.length) return null;
  return <CompetenceHisto bars={scores} height={small ? 34 : 64} />;
}

// Résultats d'une classe par compétence : moyenne des élèves (chacun pondéré par le barème)
export function ClassCompetences({ ev, rs }: { ev: Evaluation; rs: (Result | undefined)[] }) {
  const list = useCompetences();
  const cats = evalCategories(list, ev);
  if (!cats.length) return null;
  const all = rs.map((r) => competenceScores(list, ev, r));
  // Moyenne de la classe : points moyens obtenus sur les points du barème de chaque compétence
  const bars = cats.map((c) => {
    const total = ev.criteria
      .filter((cr) => cr.competenceIds?.some((k) => k === c.id || list.find((x) => x.id === k)?.parentId === c.id))
      .reduce((a, cr) => a + cr.points, 0);
    const vals = all.map((x) => x.find((y) => y.c.id === c.id)?.value).filter((v): v is number => v !== undefined);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { c, total, note: mean * total, n: vals.length };
  });
  return (
    <div className="stack" style={{ gap: 6 }}>
      <b>Réussite par compétence (moyenne de la classe)</b>
      <CompetenceHisto bars={bars} height={100} />
      <span className="small muted">Hauteur : points du barème · vert : réussi · rouge : manqué.</span>
    </div>
  );
}

export function CurFlags({ id }: { id: string }) {
  const flags = useAllFlags();
  return <FlagBadges flags={flags.get(id)} />;
}

export function GroupChip({ id }: { id: string }) {
  const g = useLiveQuery(() => db.groups.get(id), [id]);
  return g ? (
    <span className="chip cchip" style={{ background: g.color ?? 'var(--paper)', fontSize: '0.9rem', verticalAlign: 'middle' }}>
      {shortName(g.name)}
    </span>
  ) : null;
}
