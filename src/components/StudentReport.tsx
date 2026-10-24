// Statistiques d'un élève — partagé entre la vue professeur et la vue élève.
import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Card } from '../lib/db';
import { today } from '../lib/dates';
import { boxDistribution, difficultForStudent, heatmapCounts, streak, summarize } from '../lib/stats';
import { availableCards, studentSubjects } from '../lib/leitner';
import { Boxes, Heatmap, Pct, RateBar } from './widgets';
import { CardFace } from './CardFace';
import { CardDetail } from './CardDetail';
import { Icon } from './Icon';

// teacherView : présentation compacte sur une ligne (réglages, chiffres, régularité, boîtes) ; settings : réglages à y insérer
// Séances de révision : révisions espacées de moins de 30 min regroupées ; les plus récentes d'abord
export function revisionSessions(reviews: { ts: number }[], max = 7) {
  const ts = reviews.map((r) => r.ts).sort((a, b) => b - a);
  const out: { start: number; n: number }[] = [];
  for (const t of ts) {
    const last = out[out.length - 1];
    if (last && last.start - t < 30 * 60 * 1000) {
      last.start = t;
      last.n++;
    } else {
      if (out.length === max) break;
      out.push({ start: t, n: 1 });
    }
  }
  return out;
}
const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const when = (t: number) => {
  const d = new Date(t);
  return `${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
};

// compact (soutien, vue professeur) : chiffres en pictos, régularité, boîtes et dernières révisions sur une ligne
export function StudentReport({
  studentId,
  teacherView = false,
  settings,
  compact = false,
}: {
  studentId: string;
  teacherView?: boolean;
  settings?: ReactNode;
  compact?: boolean;
}) {
  const subjects = useLiveQuery(() => studentSubjects(studentId), [studentId], []);
  const [subject, setSubject] = useState<string | null>(null);
  const subj = subject ?? subjects[0];
  const data = useLiveQuery(async () => {
    if (!subj) return null;
    const reviews = (await db.reviews.where('studentId').equals(studentId).toArray()).filter((r) => r.subject === subj);
    const dist = await boxDistribution(studentId, subj);
    const hard = difficultForStudent(reviews);
    const cards = await db.cards.bulkGet(hard.map((h) => h.cardId));
    // Soutien : flashcards en cours (boîtes 1 à 7), avec leur prochaine date de révision
    const byBox: { card: Card; due: string }[][] = [[], [], [], [], [], [], [], []];
    if (compact) {
      const availList = await availableCards(studentId, subj);
      const avail = new Set(availList.map((a) => a.cardId));
      const scs = (await db.studentCards.where('studentId').equals(studentId).toArray()).filter((sc) => avail.has(sc.cardId) && sc.box > 0);
      const cs = await db.cards.bulkGet(scs.map((sc) => sc.cardId));
      scs.forEach((sc, i) => {
        const c = cs[i];
        if (c && !c.deleted) byBox[Math.min(7, sc.box)].push({ card: c, due: sc.due });
      });
      // En attente (boîte 0) : données mais pas encore vues, dans l'ordre où elles arriveront
      const started = new Set(scs.map((sc) => sc.cardId));
      const waiting = availList.filter((a) => !started.has(a.cardId)).sort((a, b) => a.pubDate.localeCompare(b.pubDate) || a.order - b.order);
      const wc = await db.cards.bulkGet(waiting.map((a) => a.cardId));
      waiting.forEach((a, i) => {
        const c = wc[i];
        if (c && !c.deleted) byBox[0].push({ card: c, due: '' });
      });
      byBox.slice(1).forEach((l) => l.sort((a, b) => a.due.localeCompare(b.due) || a.card.code.localeCompare(b.card.code)));
    }
    return {
      byBox,
      reviews,
      dist,
      hard: hard.map((h, i) => ({ agg: h, card: cards[i] })).filter((x) => x.card && !x.card.deleted),
    };
  }, [studentId, subj, compact]);
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
      {compact ? (
        <div className="panel report-line">
          <div className="report-stats">
            <span title="Série en cours (jours de révision d'affilée)">
              <Icon name="flame" size={22} /> <b>{streak(counts)} j</b>
            </span>
            <span title="Jours de révision sur les 30 derniers jours">
              <Icon name="calendar" size={22} /> <b>{sum.activeDays} / 30</b>
            </span>
            <span title="Réussite sur les 30 derniers jours">
              <Icon name="target" size={22} /> <b>{sum.total ? <Pct v={sum.success} /> : '—'}</b>
            </span>
          </div>
          <div className="tile-cards">
            <Heatmap counts={counts} />
            <Boxes dist={data.dist} compact />
          </div>
          <div className="report-sessions" title="Dernières séances de révision">
            {revisionSessions(data.reviews).map((x) => (
              <span key={x.start} title={`${x.n} flashcard(s) révisée(s)`}>
                {when(x.start)} · {x.n}
              </span>
            ))}
            {!data.reviews.length && <span className="muted">Aucune révision pour l'instant.</span>}
          </div>
        </div>
      ) : teacherView ? (
        <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
          {settings && (
            <div className="panel stack" style={{ gap: 6, padding: '12px 14px' }}>
              {settings}
            </div>
          )}
          <div
            className="panel"
            style={{
              padding: '12px 14px',
              display: 'grid',
              gridTemplateColumns: 'auto auto',
              gap: '6px 18px',
              alignContent: 'center',
            }}
          >
            {[
              ['Série', `${streak(counts)} j`],
              ['Jours (30 j)', `${sum.activeDays} / 30`],
              ['Réussite (30 j)', sum.total ? <Pct v={sum.success} /> : '—'],
              ['Score', `${sum.score} / 100`],
            ].map(([l, v], i) => (
              <div key={i}>
                <div className="muted small">{l}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="panel stack" style={{ gap: 6, padding: '12px 14px' }}>
            <b className="small">Régularité</b>
            <Heatmap counts={counts} />
          </div>
          <div className="panel stack" style={{ gap: 4, padding: '12px 14px', flex: 1, minWidth: 240 }}>
            <b className="small">
              Boîtes{' '}
              <span className="muted" style={{ fontWeight: 500 }}>
                · {total} flashcard(s) · {mastered} bien installée(s)
              </span>
            </b>
            <Boxes dist={data.dist} compact />
          </div>
        </div>
      ) : (
        <>
          {/* Les trois chiffres sur une ligne, en petit */}
          <div className="stat-row">
            <div className="panel">
              <div className="muted small">Série en cours</div>
              <div className="stat-n">
                <Icon name="flame" size={18} /> {streak(counts)} j
              </div>
            </div>
            <div className="panel">
              <div className="muted small">Jours (30 j)</div>
              <div className="stat-n">{sum.activeDays} / 30</div>
            </div>
            <div className="panel">
              <div className="muted small">Réussite (30 j)</div>
              <div className="stat-n">{sum.total ? <Pct v={sum.success} /> : '—'}</div>
            </div>
            {teacherView && (
              <div className="panel">
                <div className="muted small">Score (classement)</div>
                <div className="stat-n">{sum.score} / 100</div>
              </div>
            )}
          </div>
          <div className="panel stack">
            <h3 style={{ margin: 0 }}>Régularité</h3>
            <Heatmap counts={counts} />
          </div>
          <div className="panel stack">
            <div className="spread">
              <h3 style={{ margin: 0 }}>{teacherView ? 'Boîtes' : 'Avancement'}</h3>
              <span className="muted small">
                {total} flashcard(s){teacherView ? ` · ${mastered} bien installée(s) (boîtes 5 à 7)` : ''}
              </span>
            </div>
            <Boxes dist={data.dist} />
          </div>
        </>
      )}
      {compact && (
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>
            Flashcards en cours ({data.byBox.slice(1).reduce((a, l) => a + l.length, 0)})
            <span className="muted small" style={{ fontWeight: 600 }}>
              {' '}
              · {data.byBox[0].length} en attente
            </span>
          </h3>
          {data.byBox.every((l) => !l.length) && <span className="muted">Aucune flashcard pour l'instant.</span>}
          {[...data.byBox.slice(1).map((l, i) => [i + 1, l] as const), [0, data.byBox[0]] as const].map(
            ([box, list]) =>
              list.length > 0 && (
                <div key={box} className="stack" style={{ gap: 8 }}>
                  <b className="small">
                    {box ? `Boîte ${box}` : 'En attente (pas encore vues)'}{' '}
                    <span className="muted" style={{ fontWeight: 500 }}>· {list.length} flashcard(s)</span>
                  </b>
                  <div className="cardgrid">
                    {list.map(({ card, due }) => (
                      <div key={card.id} className="thumb" onClick={() => setOpen(card.id)}>
                        <div className="face">
                          <CardFace html={card.front} />
                        </div>
                        <div className="meta">
                          <span className="code">{card.code}</span>
                          <span className="small muted" title="Prochaine révision">
                            {!due ? 'nouvelle' : due <= today() ? 'à revoir' : `le ${due.slice(8, 10)}/${due.slice(5, 7)}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ),
          )}
        </div>
      )}
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Flashcards difficiles ({data.hard.length})</h3>
        {data.hard.length ? (
          <div className="cardgrid">
            {data.hard.slice(0, 18).map(({ agg, card }) => (
              <div key={card!.id} className="thumb" onClick={() => (teacherView || compact) && setOpen(card!.id)}>
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
          <span className="muted">Aucune flashcard difficile pour l'instant.</span>
        )}
      </div>
      {open && <CardDetail cardId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
