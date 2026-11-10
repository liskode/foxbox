// Autocorrection d'une copie par l'élève : 1. ressenti global (têtes de renard) ; 2. chaque critère du barème (4 visages) ;
// 3. sa note estimée, puis ce que le professeur a rendu visible, en face.
import { confirmBox } from './Dialog';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ResultShare, type SelfCheck } from '../lib/db';
import { faceOf, levelColor, round1 } from '../lib/grading';
import { FEELINGS, FoxFace, LEVEL_FACES, LevelFace } from './Faces';
import { Icon } from './Icon';

const fr = (x: number) => String(round1(x)).replace('.', ',');

export const useSelfCheck = (id: string) => useLiveQuery(() => db.selfChecks.get(id), [id]);

// Note estimée par l'élève, sur 20 (critères qu'il a notés)
export function selfScore(criteria: { id: string; points: number }[], levels: Record<string, number>) {
  let note = 0;
  let total = 0;
  for (const c of criteria) {
    const l = levels[c.id];
    if (l === undefined) continue;
    note += l * c.points;
    total += c.points;
  }
  return total ? { note: round1(note), total: round1(total), note20: round1((note / total) * 20) } : null;
}

const faceBtn = (on: boolean, color: string): React.CSSProperties => ({
  border: on ? '3px solid var(--ink)' : '1.5px solid var(--muted-line)',
  background: on ? color : 'var(--paper)',
  borderRadius: 12,
  padding: 4,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  minHeight: 44,
});

export function SelfCheckPanel({ share, sc }: { share: ResultShare; sc?: SelfCheck }) {
  const criteria = share.selfCheck ?? [];
  const [step, setStep] = useState(0);
  // Relit la version enregistrée (plusieurs choix rapprochés ne s'écrasent pas)
  const save = (patch: Partial<SelfCheck> | ((cur: SelfCheck | undefined) => Partial<SelfCheck>)) =>
    db.transaction('rw', db.selfChecks, async () => {
      const cur = await db.selfChecks.get(share.id);
      await db.selfChecks.put({
        id: share.id,
        evaluationId: share.evaluationId,
        studentId: share.studentId,
        teacherId: share.teacherId ?? '',
        levels: {},
        ...cur,
        ...(typeof patch === 'function' ? patch(cur) : patch),
        updatedAt: Date.now(),
      });
    });
  const levels = sc?.levels ?? {};

  if (sc?.doneAt) return <SelfCheckResult share={share} sc={sc} onSave={save} />;

  if (step === 0)
    return (
      <div className="stack" style={{ gap: 8 }}>
        <div className="notice">
          <b>Autocorrection.</b> Avant de voir la correction de ton professeur, estime toi-même ta réussite, critère par critère.
          <br />
          <b>Pour faire ton autocorrection, tu dois avoir ta copie sous les yeux.</b>
        </div>
        <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => setStep(1)}>
          <Icon name="check" size={16} /> Je m'autocorrige
        </button>
      </div>
    );

  if (step === 1)
    return (
      <div className="stack" style={{ gap: 10 }}>
        <b>1. Comment penses-tu avoir réussi cette évaluation ?</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          {FEELINGS.map((f, i) => (
            <button key={i} type="button" style={{ ...faceBtn(sc?.feeling === i, '#fff3c4'), padding: 8, font: 'inherit' }} onClick={() => save({ feeling: i })}>
              <FoxFace mood={i} size={64} />
              <span className="small" style={{ fontWeight: sc?.feeling === i ? 800 : 500, textAlign: 'center' }}>
                {f}
              </span>
            </button>
          ))}
        </div>
        <textarea
          placeholder="Un commentaire ? (facultatif)"
          defaultValue={sc?.comment ?? ''}
          onBlur={(e) => e.target.value !== (sc?.comment ?? '') && save({ comment: e.target.value })}
          style={{ fontFamily: 'var(--font)', minHeight: 60 }}
        />
        <button className="btn primary" style={{ alignSelf: 'flex-end' }} disabled={sc?.feeling === undefined} onClick={() => setStep(2)}>
          Suivant <Icon name="arrowRight" size={16} />
        </button>
      </div>
    );

  const answered = criteria.filter((c) => levels[c.id] !== undefined).length;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="spread">
        <b>2. Compare ta copie à chaque critère de réussite</b>
        <span className="small muted">
          {answered}/{criteria.length}
        </span>
      </div>
      <div className="row small muted" style={{ gap: 12 }}>
        {LEVEL_FACES.map((f, i) => (
          <span key={i} className="row" style={{ gap: 4 }}>
            <LevelFace i={i} size={18} /> {f.label}
          </span>
        ))}
      </div>
      {criteria.map((c, n) => (
        <div key={c.id} className="stack" style={{ gap: 6, borderTop: '1px solid var(--muted-line)', paddingTop: 8 }}>
          <div className="spread" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <span>
              <span className="muted small">{n + 1}.</span> {c.label || <i className="muted">(sans intitulé)</i>}
            </span>
            <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
              {c.points} pt
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {LEVEL_FACES.map((f, i) => (
              <button
                key={i}
                type="button"
                title={f.label}
                aria-label={f.label}
                style={faceBtn(levels[c.id] === f.level, f.color)}
                onClick={() => save((cur) => ({ levels: { ...cur?.levels, [c.id]: f.level } }))}
              >
                <LevelFace i={i} size={30} />
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn ghost" onClick={() => setStep(1)}>
          <Icon name="arrowLeft" size={16} /> Retour
        </button>
        <button
          className="btn primary"
          disabled={answered < criteria.length}
          onClick={async () => (await confirmBox('Valider ton autocorrection ? Tu ne pourras plus la modifier, et tu verras la correction de ton professeur.')) && save({ doneAt: Date.now() })}
        >
          Voir ma note
        </button>
      </div>
    </div>
  );
}

// 3. Résultat : note estimée, puis la correction du professeur en face (selon ce qu'il a rendu visible), et le bilan
function SelfCheckResult({ share, sc, onSave }: { share: ResultShare; sc: SelfCheck; onSave: (p: Partial<SelfCheck>) => unknown }) {
  const criteria = share.selfCheck ?? [];
  const mine = selfScore(criteria, sc.levels);
  const prof = new Map((share.detail ?? []).map((d, i) => [d.id ?? criteria[i]?.id, d]));
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 16 }}>
        {sc.feeling !== undefined && (
          <span title={FEELINGS[sc.feeling]}>
            <FoxFace mood={sc.feeling} size={48} />
          </span>
        )}
        <div className="stack" style={{ gap: 2 }}>
          <span>
            Ma note estimée : <b style={{ fontSize: '1.2rem' }}>{mine ? `${fr(mine.note20)}/20` : '—'}</b>
          </span>
          {share.note20 !== undefined && (
            <span>
              Note du professeur : <b style={{ fontSize: '1.2rem' }}>{fr(share.note20)}/20</b>
            </span>
          )}
        </div>
      </div>
      {sc.comment && <span className="small muted">Mon commentaire : « {sc.comment} »</span>}
      <table className="list">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Critère</th>
            <th style={{ whiteSpace: 'nowrap' }}>Moi</th>
            {share.detail && <th style={{ whiteSpace: 'nowrap' }}>Prof</th>}
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => {
            const l = sc.levels[c.id];
            const d = prof.get(c.id);
            return (
              <tr key={c.id}>
                <td>
                  {c.label} <span className="small muted">({c.points} pt)</span>
                </td>
                <td style={{ textAlign: 'center' }}>{l !== undefined && <LevelFace i={faceOf(l)} size={24} />}</td>
                {share.detail && (
                  <td style={{ textAlign: 'center', background: levelColor(d?.level) }}>
                    {d && d.level !== null ? (
                      <span className="row" style={{ gap: 4, justifyContent: 'center', flexWrap: 'nowrap' }}>
                        <LevelFace i={faceOf(d.level)} size={24} />
                        <span className="small">
                          {fr(d.level * d.points)}/{fr(d.points)}
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="stack" style={{ gap: 6 }}>
        <b className="small">Mon bilan, après ma correction</b>
        <textarea
          placeholder="Ce que je n'avais pas compris…"
          defaultValue={sc.before ?? ''}
          onBlur={(e) => e.target.value !== (sc.before ?? '') && onSave({ before: e.target.value })}
          style={{ fontFamily: 'var(--font)', minHeight: 56 }}
        />
        <textarea
          placeholder="Ce que maintenant j'ai compris…"
          defaultValue={sc.after ?? ''}
          onBlur={(e) => e.target.value !== (sc.after ?? '') && onSave({ after: e.target.value })}
          style={{ fontFamily: 'var(--font)', minHeight: 56 }}
        />
        <span className="small muted">Ton professeur peut lire ton bilan.</span>
      </div>
    </div>
  );
}
