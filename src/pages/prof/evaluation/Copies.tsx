// Évaluation : correction copie par copie, au clavier.
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { type Evaluation } from '../../../lib/db';
import { LEVELS, LEVEL_KEYS, emptyResult, faceOf, levelColor, saveResult, score } from '../../../lib/grading';
import { FEELINGS, FoxFace, LevelFace } from '../../../components/Faces';
import { selfScore, useSelfCheck } from '../../../components/SelfCheck';
import { Avatar } from '../../../components/Avatar';
import { Icon } from '../../../components/Icon';
import { NoteButton } from '../../../components/StudentNote';
import { EvalFeedback } from '../../../components/EvalFeedback';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { evalUnread } from '../../../lib/messages';

import { pct, isTyping, parseLevel, useResults, NoteBadge, CompetenceBadges, CurFlags, GroupChip } from './shared';

export function CopiesTab({ ev }: { ev: Evaluation }) {
  const { list, results } = useResults(ev);
  const [params, setParams] = useSearchParams();
  // ?classe= : on commence par le premier élève de cette classe
  const sid = params.get('eleve') ?? (list.find((x) => x.groupId === params.get('classe')) ?? list[0])?.student.id;
  const idx = list.findIndex((x) => x.student.id === sid);
  const cur = list[idx];
  const r = (cur && results.get(cur.student.id)) || (cur ? emptyResult(ev, cur.student.id) : undefined);
  const [focus, setFocus] = useState(0);
  const { session } = useAuth();
  const me = useLiveQuery(() => db.teachers.get(session!.id), [session?.id]);
  // Réponses des élèves pas encore vues (pastille dans la liste des copies)
  const replies = useLiveQuery(
    async () => {
      const m = new Map<string, number>();
      for (const { student } of list) m.set(student.id, await evalUnread(session!.id, ev.id, student.id));
      return m;
    },
    [ev.id, list.length, session?.id],
    new Map<string, number>(),
  );
  const [manual, setManual] = useState<string | null>(null);
  // Recherche d'un élève par son prénom (ou son nom), sans tenir compte des accents
  const [q, setQ] = useState('');
  const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const shown = q.trim() ? list.filter(({ student }) => fold(`${student.firstName} ${student.lastName}`).includes(fold(q.trim()))) : list;
  const [appr, setAppr] = useState('');
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sc = useSelfCheck(`${ev.id}|${sid}`);
  const selfDone = sc?.doneAt ? sc : undefined;

  useEffect(() => {
    setAppr(r?.appreciation ?? '');
  }, [r?.id, r?.appreciation]);
  useEffect(() => {
    setFocus(0);
    setManual(null);
  }, [sid]);
  useEffect(() => {
    rowRefs.current[focus]?.scrollIntoView({ block: 'nearest' });
  }, [focus]);

  const goStudent = (d: number) => {
    const n = list[idx + d];
    if (n) setParams({ onglet: 'copies', eleve: n.student.id }, { replace: true });
  };
  const setLevel = async (i: number, level: number | null) => {
    if (!r || !ev.criteria[i]) return;
    await saveResult(ev, { ...r, absent: false, levels: { ...r.levels, [ev.criteria[i].id]: level } });
  };

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || !r) return;
      if (e.key in LEVEL_KEYS) {
        e.preventDefault();
        await setLevel(focus, LEVEL_KEYS[e.key]);
        setFocus((f) => Math.min(ev.criteria.length - 1, f + 1)); // question suivante
      } else if (e.key === '0' || e.key === ',' || e.key === '.') {
        e.preventDefault();
        setManual(e.key === '0' ? '0' : '0,');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocus((f) => Math.min(ev.criteria.length - 1, f + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocus((f) => Math.max(0, f - 1));
      } else if (e.key === 'ArrowRight') goStudent(1);
      else if (e.key === 'ArrowLeft') goStudent(-1);
      else if (e.key === 'Backspace' || e.key === 'Delete') setLevel(focus, null);
      else if (e.key.toLowerCase() === 'a') saveResult(ev, { ...r, absent: !r.absent });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!ev.groupIds.length) return <div className="notice">Choisissez d'abord la ou les classes dans l'onglet Barème.</div>;
  if (!ev.criteria.length) return <div className="notice">Saisissez d'abord les critères dans l'onglet Barème.</div>;
  if (!cur || !r) return <div className="muted">Aucun élève dans ces classes.</div>;

  return (
    <div className="stack-phone" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 250px) 1fr', gap: 16, alignItems: 'start' }}>
      {/* Téléphone : choix de l'élève dans un menu, avec copie précédente / suivante */}
      <input
        className="show-phone"
        type="search"
        placeholder="Chercher un élève (prénom)…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          const first = list.find(({ student }) => fold(`${student.firstName} ${student.lastName}`).includes(fold(e.target.value.trim())));
          if (e.target.value.trim() && first) setParams({ onglet: 'copies', eleve: first.student.id }, { replace: true });
        }}
      />
      <div className="show-phone row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <button className="btn" onClick={() => goStudent(-1)} disabled={idx === 0} aria-label="Copie précédente">
          <Icon name="arrowLeft" />
        </button>
        <label className="tab-select" style={{ margin: 0, flex: 1 }}>
          <select value={sid ?? ''} onChange={(e) => setParams({ onglet: 'copies', eleve: e.target.value }, { replace: true })}>
            {(shown.some((x) => x.student.id === sid) ? shown : list).map(({ student }) => {
              const rr = results.get(student.id);
              return (
                <option key={student.id} value={student.id}>
                  {student.lastName} {student.firstName}
                  {rr?.absent ? ' · ABS' : score(ev, rr) ? ' ✓' : ''}
                </option>
              );
            })}
          </select>
          <Icon name="chevronDown" size={18} />
        </label>
        <button className="btn" onClick={() => goStudent(1)} disabled={idx === list.length - 1} aria-label="Copie suivante">
          <Icon name="arrowRight" />
        </button>
      </div>
      <div className="panel stack hide-phone" style={{ gap: 2, maxHeight: '75vh', overflowY: 'auto', padding: 10 }}>
        <input
          type="search"
          placeholder="Chercher (prénom)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            // Entrée : ouvre la copie du premier élève trouvé
            if (e.key === 'Enter' && shown[0]) setParams({ onglet: 'copies', eleve: shown[0].student.id }, { replace: true });
          }}
          style={{ position: 'sticky', top: 0, zIndex: 1, marginBottom: 6 }}
        />
        {q.trim() && !shown.length && <span className="small muted">Aucun élève trouvé.</span>}
        {shown.map(({ student, former }) => {
          const rr = results.get(student.id);
          const done = rr?.absent || score(ev, rr);
          return (
            <button
              key={student.id}
              className="row"
              onClick={() => setParams({ onglet: 'copies', eleve: student.id }, { replace: true })}
              style={{
                gap: 8,
                border: 'none',
                background: student.id === sid ? 'var(--matiere)' : 'transparent',
                borderRadius: 10,
                padding: '4px 6px',
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'left',
                flexWrap: 'nowrap',
              }}
            >
              <Avatar student={student} size={26} />
              <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700, opacity: former ? 0.45 : 1 }} title={former ? 'Parti(e) en cours d’année' : undefined}>
                {student.lastName} {student.firstName} <CurFlags id={student.id} />
              </span>
              {(replies.get(student.id) ?? 0) > 0 && (
                <span className="badge" title="Nouvelle réponse de l'élève">
                  {replies.get(student.id)}
                </span>
              )}
              <span style={{ fontSize: '0.8rem' }}>{rr?.absent ? 'ABS' : done ? <Icon name="check" size={14} /> : ''}</span>
            </button>
          );
        })}
      </div>

      <div className="stack">
        {/* En-tête : élève, note et compétences à gauche ; appréciation générale à droite */}
        <div className="panel stack-phone" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 38%)', gap: 20, alignItems: 'stretch' }}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
              <Link to={`/prof/eleves/${cur.student.id}`} title="Ouvrir la fiche de l'élève">
                <Avatar student={cur.student} size={70} zoom />
              </Link>
              <div>
                <h2 style={{ margin: 0 }}>
                  {cur.student.firstName} {cur.student.lastName} <GroupChip id={cur.groupId} /> <CurFlags id={cur.student.id} />
                </h2>
                <div className="small muted">
                  Copie {idx + 1}/{list.length} · ← → copie précédente / suivante
                </div>
              </div>
            </div>
            <div className="row">
              <div style={{ fontSize: '1.4rem' }}>
                <NoteBadge ev={ev} r={r} />
              </div>
              <CompetenceBadges ev={ev} r={r} />
              <button className={'btn small' + (r.absent ? ' danger' : ' ghost')} onClick={() => saveResult(ev, { ...r, absent: !r.absent })}>
                {r.absent ? <>Absent <Icon name="check" size={14} /></> : 'Absent (A)'}
              </button>
              <NoteButton student={cur.student} />
            </div>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <b className="small">Appréciation générale</b>
            <textarea
              value={appr}
              onChange={(e) => setAppr(e.target.value)}
              onBlur={() => appr !== (r.appreciation ?? '') && saveResult(ev, { ...r, appreciation: appr })}
              placeholder="Appréciation sur la copie…"
              style={{ fontFamily: 'var(--font)', fontSize: '0.95rem', minHeight: 90, flex: 1 }}
            />
            <span className="small muted">
              Enregistrée en quittant le champ. {ev.visibility.appreciation ? 'Visible par l’élève.' : 'Non visible par l’élève.'}
            </span>
          </div>
        </div>

        <div className="panel stack" style={{ gap: 4, opacity: r.absent ? 0.4 : 1 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>
            Touches : <span className="code">1 2 3 4</span> = 0 · 40 · 80 · 100 % (puis question suivante) · <span className="code">0</span> ou{' '}
            <span className="code">,</span> = saisie libre (0,2…) · ↑ ↓ question · Effacer = non noté
          </div>
          {selfDone && (
            <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
              <b className="small muted" title="Autocorrection" style={{ width: 28, textAlign: 'center', cursor: 'help' }}>
                A.C.
              </b>
            </div>
          )}
          {ev.criteria.map((c, i) => {
            const l = r.levels[c.id];
            const active = i === focus;
            return (
              <div key={c.id} className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
              <div
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onClick={() => setFocus(i)}
                className="row"
                style={{
                  flex: 1,
                  minWidth: 0,
                  flexWrap: 'wrap', // téléphone : les boutons passent sous l'intitulé
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 10,
                  border: active ? '2.5px solid var(--ink)' : '2.5px solid transparent',
                  background: levelColor(l),
                  cursor: 'pointer',
                }}
              >
                <span className="muted small" style={{ width: 22 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, minWidth: 90, fontWeight: 600 }}>
                  {c.label || <i className="muted">(sans intitulé)</i>}
                  {c.cardIds?.length ? <span className="small muted"> · <Icon name="cards" size={13} />{c.cardIds.length}</span> : null}
                </span>
                <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
                  {c.points} pt
                </span>
                <div className="row" style={{ gap: 3, flexWrap: 'nowrap' }}>
                  {LEVELS.map((v, k) => (
                    <button
                      key={v}
                      title={`Touche ${k + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocus(i);
                        setLevel(i, v);
                      }}
                      style={{
                        width: 40,
                        padding: '3px 0',
                        borderRadius: 8,
                        border: l === v ? '2.5px solid var(--ink)' : '1.5px solid var(--muted-line)',
                        background: l === v ? levelColor(v) : 'var(--paper)',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        font: 'inherit',
                      }}
                    >
                      {v * 100}
                    </button>
                  ))}
                </div>
                {active && manual !== null ? (
                  <input
                    autoFocus
                    value={manual}
                    style={{ width: 64 }}
                    onChange={(e) => setManual(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const v = parseLevel(manual);
                        if (v !== undefined) {
                          await setLevel(i, v);
                          setFocus((f) => Math.min(ev.criteria.length - 1, f + 1));
                        }
                        setManual(null);
                      } else if (e.key === 'Escape') setManual(null);
                    }}
                    onBlur={() => setManual(null)}
                  />
                ) : (
                  <span style={{ width: 64, textAlign: 'right', fontWeight: 900 }}>{l === null || l === undefined ? '' : `${pct(l)} %`}</span>
                )}
              </div>
              {selfDone && (
                <span
                  style={{ width: 28, display: 'grid', placeItems: 'center', flex: 'none' }}
                  title={selfDone.levels[c.id] !== undefined ? `Autocorrection : ${pct(selfDone.levels[c.id])} %` : 'Autocorrection'}
                >
                  {selfDone.levels[c.id] !== undefined && <LevelFace i={faceOf(selfDone.levels[c.id])} size={22} />}
                </span>
              )}
              </div>
            );
          })}
        </div>

        {ev.visibility.selfCheck && <SelfCheckSummary ev={ev} sc={sc} name={cur.student.firstName} prof={score(ev, r)?.note20} />}

        {/* Appréciation vocale : l'élève l'écoute dans son espace, on voit s'il l'a écoutée, il peut répondre */}
        <div className="panel stack" style={{ gap: 8 }}>
          <h3 className="panel-title">
            <Icon name="mic" size={16} /> Appréciation vocale et échanges
          </h3>
          <EvalFeedback
            key={cur.student.id}
            evaluationId={ev.id}
            studentId={cur.student.id}
            teacherId={session!.id}
            me={{ id: session!.id, name: me?.name ?? 'Professeur' }}
            role="prof"
            studentName={cur.student.firstName}
          />
          <span className="small muted">L’élève l’écoute dans son espace (onglet Évaluations) quand la copie est rendue, et peut répondre par écrit ou par un vocal.</span>
        </div>
      </div>
    </div>
  );
}

// Autocorrection de l'élève : ressenti, note estimée face à la vôtre, bilan
function SelfCheckSummary({ ev, sc, name, prof }: { ev: Evaluation; sc?: import('../../../lib/db').SelfCheck; name: string; prof?: number }) {
  const mine = sc?.doneAt ? selfScore(ev.criteria, sc.levels) : null;
  const gap = mine && prof !== undefined ? Math.round((mine.note20 - prof) * 10) / 10 : null;
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <h3 className="panel-title">
        <Icon name="user" size={16} /> Autocorrection de {name}
      </h3>
      {!sc ? (
        <span className="small muted">Pas encore commencée{Object.values(ev.returned ?? {}).some(Boolean) ? '.' : ' (cochez « Copies rendues » pour sa classe dans le Barème).'}</span>
      ) : (
        <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
          {sc.feeling !== undefined && (
            <span className="stack" style={{ alignItems: 'center', gap: 2, maxWidth: 110 }}>
              <FoxFace mood={sc.feeling} size={52} />
              <span className="small muted" style={{ textAlign: 'center' }}>
                {FEELINGS[sc.feeling]}
              </span>
            </span>
          )}
          <div className="stack" style={{ gap: 4, flex: 1, minWidth: 200 }}>
            {sc.doneAt ? (
              <span>
                Note estimée : <b>{mine ? `${mine.note20}/20` : '—'}</b>
                {gap !== null && (
                  <span className={'tag ' + (Math.abs(gap) < 2 ? 'ok' : 'warn')} style={{ marginLeft: 8 }}>
                    {Math.abs(gap) < 2 ? 'proche de votre note' : gap > 0 ? `se surestime de ${gap} pt` : `se sous-estime de ${-gap} pt`}
                  </span>
                )}
              </span>
            ) : (
              <span className="small muted">En cours (critères pas encore tous estimés).</span>
            )}
            {sc.comment && <span className="small">« {sc.comment} »</span>}
            {sc.before && (
              <span className="small">
                <b>Ce que je n'avais pas compris :</b> {sc.before}
              </span>
            )}
            {sc.after && (
              <span className="small">
                <b>Ce que maintenant j'ai compris :</b> {sc.after}
              </span>
            )}
            {sc.doneAt && <span className="small muted">Son estimation apparaît en petit visage à côté de chaque critère.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
