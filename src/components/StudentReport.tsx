// Statistiques d'un élève — partagé entre la vue professeur et la vue élève.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { boxDistribution, difficultForStudent, heatmapCounts, streak, summarize } from '../lib/stats';
import { studentSubjects } from '../lib/leitner';
import { Boxes, Heatmap, Pct, RateBar } from './widgets';
import { CardFace } from './CardFace';
import { CardDetail } from './CardDetail';

export function StudentReport({ studentId, teacherView = false }: { studentId: string; teacherView?: boolean }) {
  const subjects = useLiveQuery(() => studentSubjects(studentId), [studentId], []);
  const [subject, setSubject] = useState<string | null>(null);
  const subj = subject ?? subjects[0];
  const data = useLiveQuery(async () => {
    if (!subj) return null;
    const reviews = (await db.reviews.where('studentId').equals(studentId).toArray()).filter((r) => r.subject === subj);
    const dist = await boxDistribution(studentId, subj);
    const hard = difficultForStudent(reviews);
    const cards = await db.cards.bulkGet(hard.map((h) => h.cardId));
    return { reviews, dist, hard: hard.map((h, i) => ({ agg: h, card: cards[i] })).filter((x) => x.card && !x.card.deleted) };
  }, [studentId, subj]);
  const [open, setOpen] = useState<string | null>(null);

  if (!subjects.length) return <div className="notice">Pas encore de classe : rien à afficher.</div>;
  if (!data) return <div className="muted">Calcul…</div>;
  const counts = heatmapCounts(data.reviews);
  const sum = summarize(data.reviews);
  const total = data.dist.reduce((a, b) => a + b, 0);
  const mastered = data.dist.slice(5).reduce((a, b) => a + b, 0);

  return (
    <div className="stack">
      {subjects.length > 1 && (
        <div className="row">
          {subjects.map((s) => (
            <button key={s} className={'btn small' + (s === subj ? ' primary' : ' ghost')} onClick={() => setSubject(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="grid3">
        <div className="panel">
          <div className="muted small">Série en cours</div>
          <div style={{ fontSize: '2rem', fontWeight: 900 }}>🔥 {streak(counts)} j</div>
        </div>
        <div className="panel">
          <div className="muted small">Jours de révision (30 j)</div>
          <div style={{ fontSize: '2rem', fontWeight: 900 }}>{sum.activeDays} / 30</div>
        </div>
        <div className="panel">
          <div className="muted small">Réussite (30 j)</div>
          <div style={{ fontSize: '2rem', fontWeight: 900 }}>{sum.total ? <Pct v={sum.success} /> : '—'}</div>
        </div>
        {teacherView && (
          <div className="panel">
            <div className="muted small">Score (classement)</div>
            <div style={{ fontSize: '2rem', fontWeight: 900 }}>{sum.score} / 100</div>
          </div>
        )}
      </div>
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Régularité</h3>
        <Heatmap counts={counts} />
      </div>
      <div className="panel stack">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Mes boîtes</h3>
          <span className="muted small">
            {total} carte(s) · {mastered} bien installée(s) (boîtes 5 à 7)
          </span>
        </div>
        <Boxes dist={data.dist} />
      </div>
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Cartes difficiles ({data.hard.length})</h3>
        {data.hard.length ? (
          <div className="cardgrid">
            {data.hard.slice(0, 18).map(({ agg, card }) => (
              <div key={card!.id} className="thumb" onClick={() => teacherView && setOpen(card!.id)}>
                <div className="face">
                  <CardFace html={card!.front} />
                </div>
                <div className="meta" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <span className="code">{card!.code}</span>
                  <RateBar agg={agg} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="muted">Aucune carte difficile pour l'instant 👍</span>
        )}
      </div>
      {open && <CardDetail cardId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
