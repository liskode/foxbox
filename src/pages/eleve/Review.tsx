import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { db, type Card, type Rating } from '../../lib/db';
import { recordAnswer, todaySession } from '../../lib/leitner';
import { CardFace } from '../../components/CardFace';
import { Icon } from '../../components/Icon';

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
      } else if (e.key === '1') answer('forgot');
      else if (e.key === '2') answer('hard');
      else if (e.key === '3') answer('easy');
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
            <span className="tag bad">{tally.forgot} à revoir</span>
            <span className="tag warn">{tally.hard} dur</span>
            <span className="tag ok">{tally.easy} facile</span>
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
        <div className="review-top">
          <Link to="/eleve" className="icon-btn" style={{ border: '1.5px solid var(--muted-line)', background: 'var(--paper)' }} title="Arrêter la révision">
            <Icon name="x" />
          </Link>
          <div className="bar">
            <span>
              {i + 1} / {queue.length}
            </span>
            <div className="track">
              <div style={{ width: `${(i / queue.length) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="flip" onClick={flip} style={{ cursor: flipped ? 'default' : 'pointer' }}>
          <CardFace html={flipped ? card.back : card.front} full />
        </div>
        {/* Sur téléphone, les boutons restent en bas de l'écran, sous le pouce */}
        <div className="review-actions">
          {!flipped ? (
            <button className="btn primary big reveal" style={{ width: '100%' }} onClick={flip}>
              Voir la réponse
            </button>
          ) : (
            <div className="answers">
              <button className="forgot" onClick={() => answer('forgot')}>
                <Icon name="x" size={22} stroke={2.4} />
                Je ne sais pas
              </button>
              <button className="hard" onClick={() => answer('hard')}>
                <Icon name="minus" size={22} stroke={2.4} />
                Dur
              </button>
              <button className="easy" onClick={() => answer('easy')}>
                <Icon name="check" size={22} stroke={2.6} />
                Facile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
