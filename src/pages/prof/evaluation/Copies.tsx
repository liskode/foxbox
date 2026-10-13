// Évaluation : correction copie par copie, au clavier.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type Evaluation } from '../../../lib/db';
import { LEVELS, LEVEL_KEYS, emptyResult, levelColor, saveResult, score } from '../../../lib/grading';
import { Avatar } from '../../../components/Avatar';
import { NoteButton } from '../../../components/StudentNote';

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
  const [manual, setManual] = useState<string | null>(null);
  const [appr, setAppr] = useState('');
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 250px) 1fr', gap: 16, alignItems: 'start' }}>
      <div className="panel stack" style={{ gap: 2, maxHeight: '75vh', overflowY: 'auto', padding: 10 }}>
        {list.map(({ student }) => {
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
              <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700 }}>
                {student.lastName} {student.firstName} <CurFlags id={student.id} />
              </span>
              <span style={{ fontSize: '0.8rem' }}>{rr?.absent ? 'ABS' : done ? '✓' : ''}</span>
            </button>
          );
        })}
      </div>

      <div className="stack">
        <div className="panel spread">
          <div className="row" style={{ gap: 14 }}>
            <Avatar student={cur.student} size={70} zoom />
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
              {r.absent ? 'Absent ✓' : 'Absent (A)'}
            </button>
            <NoteButton student={cur.student} />
          </div>
        </div>

        <div className="panel stack" style={{ gap: 4, opacity: r.absent ? 0.4 : 1 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>
            Touches : <span className="code">/ 1 2 3 4</span> = 0 · 25 · 50 · 75 · 100 % (puis question suivante) · <span className="code">0</span> ou{' '}
            <span className="code">,</span> = saisie libre (0,2…) · ↑ ↓ question · Effacer = non noté
          </div>
          {ev.criteria.map((c, i) => {
            const l = r.levels[c.id];
            const active = i === focus;
            return (
              <div
                key={c.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onClick={() => setFocus(i)}
                className="row"
                style={{
                  flexWrap: 'nowrap',
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
                <span style={{ flex: 1, fontWeight: 600 }}>
                  {c.label || <i className="muted">(sans intitulé)</i>}
                  {c.cardIds?.length ? <span className="small muted"> · 🃏{c.cardIds.length}</span> : null}
                </span>
                <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
                  {c.points} pt
                </span>
                <div className="row" style={{ gap: 3, flexWrap: 'nowrap' }}>
                  {LEVELS.map((v, k) => (
                    <button
                      key={v}
                      title={`Touche ${['/', '1', '2', '3', '4'][k]}`}
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
            );
          })}
        </div>

        <div className="panel stack">
          <b>Appréciation générale</b>
          <textarea
            value={appr}
            onChange={(e) => setAppr(e.target.value)}
            onBlur={() => appr !== (r.appreciation ?? '') && saveResult(ev, { ...r, appreciation: appr })}
            placeholder="Appréciation sur la copie…"
            style={{ fontFamily: 'var(--font)', fontSize: '0.95rem', minHeight: 80 }}
          />
          <span className="small muted">
            Enregistrée en quittant le champ. {ev.visibility.appreciation ? 'Visible par l’élève.' : 'Non visible par l’élève.'}
          </span>
        </div>
      </div>
    </div>
  );
}
