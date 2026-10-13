// Classe : onglet Flashcards (régularité, élèves à relancer, flashcards difficiles, classement).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../lib/db';
import { groupOverview } from '../../../lib/stats';
import { frDate } from '../../../lib/dates';
import { CardFace } from '../../../components/CardFace';
import { CardDetail } from '../../../components/CardDetail';
import { Heatmap, Pct, RateBar } from '../../../components/widgets';
import { heatmapCounts } from '../../../lib/stats';
import { StudentName } from '../../../components/Avatar';
import { NoteButton } from '../../../components/StudentNote';

export function StatsTab({ groupId }: { groupId: string }) {
  const data = useLiveQuery(() => groupOverview(groupId), [groupId]);
  const cards = useLiveQuery(async () => (data ? db.cards.bulkGet(data.cards.slice(0, 12).map((c) => c.cardId)) : []), [data]);
  const nav = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <div className="muted">Calcul…</div>;
  const dropped = data.rows.filter((r) => r.inactiveDays === null || r.inactiveDays >= 5);

  return (
    <div className="stack">
      <div className="grid2">
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>Régularité de la classe</h3>
          <Heatmap counts={heatmapCounts(data.reviews)} weeks={16} />
        </div>
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>⚠️ À relancer ({dropped.length})</h3>
          <span className="small muted">Aucune révision depuis 5 jours ou plus.</span>
          {dropped.length ? (
            <div className="row" style={{ gap: 6 }}>
              {dropped.map((r) => (
                <Link
                  key={r.student.id}
                  to={`/prof/eleves/${r.student.id}?classe=${data.group.id}`}
                  className="chip"
                  style={{ textDecoration: 'none', padding: '2px 10px 2px 2px', background: 'var(--paper)' }}
                >
                  <StudentName student={r.student} size={26} short /> · {r.inactiveDays === null ? 'jamais' : `${r.inactiveDays} j`}
                </Link>
              ))}
            </div>
          ) : (
            <span>Tout le monde révise 🎉</span>
          )}
        </div>
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Flashcards difficiles pour la classe</h3>
        <span className="small muted">Taux de réussite le plus bas (flashcards vues au moins 3 fois). Cliquez pour voir la flashcard.</span>
        <div className="cardgrid">
          {data.cards.slice(0, 12).map((a, i) => {
            const c = cards?.[i];
            if (!c) return null;
            return (
              <div key={a.cardId} className="thumb" onClick={() => setOpen(c.id)}>
                <div className="face">
                  <CardFace html={c.front} />
                </div>
                <div className="meta" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <span className="code">{c.code}</span>
                  <RateBar agg={a} />
                </div>
              </div>
            );
          })}
        </div>
        {!data.cards.length && <span className="muted">Pas encore assez de révisions.</span>}
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Classement (30 derniers jours)</h3>
        <span className="small muted">Score = 50 % régularité (jours avec révision) + 50 % réussite (vert + orange). Visible par vous seul.</span>
        <div style={{ overflowX: 'auto' }}>
          <table className="list">
            <thead>
              <tr>
                <th>#</th>
                <th>Élève</th>
                <th>Score</th>
                <th>Régularité</th>
                <th>Réussite</th>
                <th>Flashcards</th>
                <th>Dernière révision</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={r.student.id} className="click" onClick={() => nav(`/prof/eleves/${r.student.id}?classe=${data.group.id}`)}>
                  <td>{i + 1}</td>
                  <td>
                    <b>
                      <StudentName student={r.student} />
                    </b>
                  </td>
                  <td>
                    <b>{r.summary.score}</b>
                  </td>
                  <td>{r.summary.activeDays} j / 30</td>
                  <td>{r.summary.total ? <Pct v={r.summary.success} /> : '—'}</td>
                  <td>{r.summary.total}</td>
                  <td>
                    {r.summary.lastDay ? frDate(r.summary.lastDay) : 'jamais'}
                    {r.inactiveDays !== null && r.inactiveDays >= 5 && ' ⚠️'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <NoteButton student={r.student} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && <CardDetail cardId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
