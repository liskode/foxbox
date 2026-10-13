// Évaluation : grille (critères en lignes, élèves en colonnes), comme le tableur.
import { useEffect, useState } from 'react';
import { type Evaluation } from '../../../lib/db';
import { LEVEL_KEYS, emptyResult, levelColor, saveResult, score } from '../../../lib/grading';
import { Avatar } from '../../../components/Avatar';
import { useCompetences } from '../../../components/CompetencePicker';
import { competenceScores, evalCategories, masteryOf } from '../../../lib/competences';

import { pct, isTyping, parseLevel, useResults } from './shared';

// ---------------------------------------------------------------- Grille (comme le tableur : critères en lignes, élèves en colonnes)
export function GrilleTab({ ev }: { ev: Evaluation }) {
  const { list, results } = useResults(ev);
  const comps = useCompetences();
  const [cell, setCell] = useState<[number, number]>([0, 0]); // [critère, élève]
  const [manual, setManual] = useState<string | null>(null);

  const setLevel = async (ci: number, si: number, level: number | null) => {
    const st = list[si]?.student;
    const c = ev.criteria[ci];
    if (!st || !c) return;
    const r = results.get(st.id) ?? emptyResult(ev, st.id);
    await saveResult(ev, { ...r, absent: false, levels: { ...r.levels, [c.id]: level } });
  };

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const [ci, si] = cell;
      const clamp = (a: number, b: number) => setCell([Math.max(0, Math.min(ev.criteria.length - 1, a)), Math.max(0, Math.min(list.length - 1, b))]);
      if (e.key in LEVEL_KEYS) {
        e.preventDefault();
        await setLevel(ci, si, LEVEL_KEYS[e.key]);
        clamp(ci + 1, si);
      } else if (e.key === '0' || e.key === ',' || e.key === '.') {
        e.preventDefault();
        setManual(e.key === '0' ? '0' : '0,');
      } else if (e.key === 'ArrowDown') (e.preventDefault(), clamp(ci + 1, si));
      else if (e.key === 'ArrowUp') (e.preventDefault(), clamp(ci - 1, si));
      else if (e.key === 'ArrowRight') (e.preventDefault(), clamp(ci, si + 1));
      else if (e.key === 'ArrowLeft') (e.preventDefault(), clamp(ci, si - 1));
      else if (e.key === 'Backspace' || e.key === 'Delete') setLevel(ci, si, null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!ev.groupIds.length || !ev.criteria.length) return <div className="notice">Complétez d'abord le barème et les classes.</div>;

  return (
    <div className="panel stack">
      <span className="small muted">
        Même clavier que la correction copie par copie : <span className="code">/ 1 2 3 4</span>, <span className="code">0</span> pour une valeur
        libre, flèches pour se déplacer (↑ ↓ question, ← → élève).
      </span>
      <div style={{ overflow: 'auto', maxHeight: '75vh' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, top: 0, background: 'var(--paper)', zIndex: 3, minWidth: 220 }} />
              {list.map(({ student }, si) => (
                <th key={student.id} style={{ position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 2, padding: 2, width: 46 }}>
                  <div className="stack" style={{ alignItems: 'center', gap: 2 }} title={`${student.firstName} ${student.lastName}`}>
                    <Avatar student={student} size={28} zoom />
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: si === cell[1] ? 900 : 600,
                        maxWidth: 46,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {student.firstName}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ev.criteria.map((c, ci) => (
              <tr key={c.id}>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    background: 'var(--paper)',
                    zIndex: 1,
                    padding: '2px 6px',
                    fontWeight: ci === cell[0] ? 900 : 600,
                    borderBottom: '1px solid var(--muted-line)',
                  }}
                >
                  {ci + 1}. {c.label} <span className="muted">({c.points})</span>
                </td>
                {list.map(({ student }, si) => {
                  const r = results.get(student.id);
                  const l = r?.levels[c.id];
                  const on = ci === cell[0] && si === cell[1];
                  return (
                    <td
                      key={student.id}
                      onClick={() => setCell([ci, si])}
                      style={{
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: r?.absent ? '#e9e5dc' : levelColor(l),
                        outline: on ? '2.5px solid var(--ink)' : '1px solid var(--muted-line)',
                        outlineOffset: on ? -2 : -1,
                        height: 26,
                        fontWeight: 800,
                      }}
                    >
                      {on && manual !== null ? (
                        <input
                          autoFocus
                          value={manual}
                          style={{ width: 40, padding: 1, fontSize: '0.75rem' }}
                          onChange={(e) => setManual(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              const v = parseLevel(manual);
                              if (v !== undefined) {
                                await setLevel(ci, si, v);
                                setCell([Math.min(ev.criteria.length - 1, ci + 1), si]);
                              }
                              setManual(null);
                            } else if (e.key === 'Escape') setManual(null);
                          }}
                          onBlur={() => setManual(null)}
                        />
                      ) : r?.absent ? (
                        'abs'
                      ) : (
                        pct(l)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td style={{ position: 'sticky', left: 0, background: 'var(--paper)', padding: '4px 6px', fontWeight: 900 }}>Note /20</td>
              {list.map(({ student }) => (
                <td key={student.id} style={{ textAlign: 'center', fontWeight: 900 }}>
                  {score(ev, results.get(student.id))?.note20 ?? ''}
                </td>
              ))}
            </tr>
            {evalCategories(comps, ev).map((cat) => (
              <tr key={cat.id}>
                <td style={{ position: 'sticky', left: 0, background: 'var(--paper)', padding: '4px 6px', fontWeight: 800 }} title={cat.name}>
                  <span style={{ background: cat.color, borderRadius: 6, padding: '0 6px' }}>{cat.code}</span> %
                </td>
                {list.map(({ student }) => {
                  const sc = competenceScores(comps, ev, results.get(student.id)).find((x) => x.c.id === cat.id);
                  return (
                    <td
                      key={student.id}
                      title={sc ? `${cat.name} : ${sc.note}/${sc.total} pts · ${masteryOf(sc.value).name}` : undefined}
                      style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', background: sc ? masteryOf(sc.value).color : undefined }}
                    >
                      {sc ? Math.round(sc.value * 100) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
