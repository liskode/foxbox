import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { db, type Card, type Rating } from '../../lib/db';
import { recordAnswer, todaySession } from '../../lib/leitner';
import { CardFace } from '../../components/CardFace';

export function ReviewSession() {
  const { session } = useAuth();
  const { subject = '' } = useParams();
  const [params] = useSearchParams();
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const flippedAt = useRef(0);
  const [tally, setTally] = useState({ easy: 0, hard: 0, forgot: 0 });

  useEffect(() => {
    (async () => {
      const s = await todaySession(session!.id, subject, Number(params.get('extra') ?? 0));
      const cards = await db.cards.bulkGet(s.queue);
      setQueue(cards.filter(Boolean) as Card[]);
    })();
  }, [session, subject, params]);

  const flip = useCallback(() => {
    setFlipped((f) => {
      if (!f) flippedAt.current = Date.now();
      return true;
    });
  }, []);

  const answer = useCallback(
    async (r: Rating) => {
      // Évite qu'un double appui sur « Voir la réponse » enregistre une réponse par erreur
      if (!queue || !flipped || Date.now() - flippedAt.current < 500) return;
      await recordAnswer(session!.id, queue[i].id, subject, r);
      setTally((t) => ({ ...t, [r]: t[r] + 1 }));
      setFlipped(false);
      setI((n) => n + 1);
    },
    [queue, i, flipped, session, subject],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      } else if (e.key === '1') answer('easy');
      else if (e.key === '2') answer('hard');
      else if (e.key === '3') answer('forgot');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, flip]);

  if (!queue) return null;
  const card = queue[i];

  if (!card) {
    const total = tally.easy + tally.hard + tally.forgot;
    return (
      <div className="page narrow stack" style={{ textAlign: 'center', alignItems: 'center' }}>
        <img src="./logo.png" alt="" style={{ width: 140 }} />
        <h1 className="title">{total ? 'Bravo !' : 'Rien à revoir'}</h1>
        {total > 0 && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <span className="chip" style={{ background: 'var(--easy)', color: '#fff' }}>{tally.easy} facile</span>
            <span className="chip" style={{ background: 'var(--hard)' }}>{tally.hard} dur</span>
            <span className="chip" style={{ background: 'var(--forgot)', color: '#fff' }}>{tally.forgot} à revoir</span>
          </div>
        )}
        <Link to="/eleve" className="btn primary big">
          Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="review">
        <div className="spread">
          <Link to="/eleve" className="small muted">
            ✕ Arrêter
          </Link>
          <span className="small muted">
            {i + 1} / {queue.length}
          </span>
        </div>
        <div className="progress">
          <div style={{ width: `${(i / queue.length) * 100}%` }} />
        </div>
        <div className="flip" onClick={flip} style={{ cursor: flipped ? 'default' : 'pointer' }}>
          <CardFace html={flipped ? card.back : card.front} full />
        </div>
        {!flipped ? (
          <button className="btn primary big" style={{ justifyContent: 'center' }} onClick={flip}>
            Voir la réponse
          </button>
        ) : (
          <div className="answers">
            <button className="easy" onClick={() => answer('easy')}>
              Facile
            </button>
            <button className="hard" onClick={() => answer('hard')}>
              Dur
            </button>
            <button className="forgot" onClick={() => answer('forgot')}>
              Je ne sais pas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
