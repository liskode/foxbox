// Évaluation : grille (critères en lignes, élèves en colonnes), comme le tableur.
// Colonne « Tous » (moyenne de chaque critère), puis chaque classe : sa colonne de moyennes, et ses élèves (repliables).
import { Fragment, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, shortName, type Evaluation, type Group, type Result } from '../../../lib/db';
import { LEVEL_KEYS, emptyResult, round1, saveResult, score } from '../../../lib/grading';
import { levelCellColor, overallColor } from '../../../lib/gradeColors';
import { GradeColorsEditor, useGradeColors } from '../../../components/GradeColorsEditor';
import { Avatar } from '../../../components/Avatar';
import { Icon } from '../../../components/Icon';
import { useCompetences } from '../../../components/CompetencePicker';
import { childrenOf, competenceScores, evalCategories, masteryOf, type Competence } from '../../../lib/competences';

import { pct, isTyping, parseLevel, useResults } from './shared';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// ---------------------------------------------------------------- Grille (comme le tableur : critères en lignes, élèves en colonnes)
export function GrilleTab({ ev }: { ev: Evaluation }) {
  const { list, results } = useResults(ev);
  const comps = useCompetences();
  const gc = useGradeColors(); // couleurs de réussite (réglables)
  const groups = useLiveQuery(
    async () => ((await db.groups.bulkGet(ev.groupIds)).filter(Boolean) as Group[]).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })),
    [ev.groupIds.join()],
    [],
  );
  const [folded, setFolded] = useState<Set<string>>(new Set()); // classes repliées
  const [cell, setCell] = useState<[number, number]>([0, 0]); // [critère, élève (rang dans list)]
  const [manual, setManual] = useState<string | null>(null);

  // Élèves rangés par classe ; seuls ceux des classes dépliées sont navigables au clavier
  const byGroup = groups.map((g) => ({ g, items: list.map((x, si) => ({ ...x, si })).filter((x) => x.groupId === g.id) }));
  const visible = byGroup.flatMap(({ g, items }) => (folded.has(g.id) ? [] : items.map((x) => x.si)));
  const cats = evalCategories(comps, ev);
  // Lignes de compétences : chaque catégorie, puis ses sous-compétences utilisées dans le barème
  const used = new Set(ev.criteria.flatMap((c) => c.competenceIds ?? []));
  const rows = cats.flatMap((cat) => [{ c: cat, sub: false }, ...childrenOf(comps, cat.id).filter((k) => used.has(k.id)).map((k) => ({ c: k, sub: true }))]);
  // Réussite d'une copie sur une catégorie (barème pondéré) ou une sous-compétence (critères qui la portent)
  const scoreOf = (r: Result, k: Competence) => {
    if (!k.parentId) return competenceScores(comps, ev, r).find((x) => x.c.id === k.id);
    let note = 0;
    let total = 0;
    for (const cr of ev.criteria) {
      const l = r.levels[cr.id];
      if (!cr.competenceIds?.includes(k.id) || l === null || l === undefined) continue;
      note += l * cr.points;
      total += cr.points;
    }
    return total ? { note, total, value: note / total } : undefined;
  };

  const setLevel = async (ci: number, si: number, level: number | null) => {
    const st = list[si]?.student;
    const c = ev.criteria[ci];
    if (!st || !c) return;
    const r = results.get(st.id) ?? emptyResult(ev, st.id);
    await saveResult(ev, { ...r, absent: false, levels: { ...r.levels, [c.id]: level } });
  };

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || !visible.length) return;
      const [ci, si] = cell;
      const vi = Math.max(0, visible.indexOf(si));
      const go = (c: number, v: number) =>
        setCell([Math.max(0, Math.min(ev.criteria.length - 1, c)), visible[Math.max(0, Math.min(visible.length - 1, v))]]);
      if (e.key in LEVEL_KEYS) {
        e.preventDefault();
        await setLevel(ci, visible[vi], LEVEL_KEYS[e.key]);
        go(ci + 1, vi);
      } else if (e.key === '0' || e.key === ',' || e.key === '.') {
        e.preventDefault();
        setManual(e.key === '0' ? '0' : '0,');
      } else if (e.key === 'ArrowDown') (e.preventDefault(), go(ci + 1, vi));
      else if (e.key === 'ArrowUp') (e.preventDefault(), go(ci - 1, vi));
      else if (e.key === 'ArrowRight') (e.preventDefault(), go(ci, vi + 1));
      else if (e.key === 'ArrowLeft') (e.preventDefault(), go(ci, vi - 1));
      else if (e.key === 'Backspace' || e.key === 'Delete') setLevel(ci, visible[vi], null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!ev.groupIds.length || !ev.criteria.length) return <div className="notice">Complétez d'abord le barème et les classes.</div>;

  const toggle = (id: string) => setFolded((f) => (f.has(id) ? new Set([...f].filter((x) => x !== id)) : new Set([...f, id])));
  const present = (rs: (Result | undefined)[]) => rs.filter((r): r is Result => !!r && !r.absent);
  const rsOf = (items: { student: { id: string } }[]) => present(items.map((x) => results.get(x.student.id)));
  const all = rsOf(list);
  // Moyennes (en %) d'un critère et de la note /20, sur un ensemble de copies
  const critMean = (rs: Result[], cid: string) => mean(rs.map((r) => r.levels[cid]).filter((l): l is number => l !== null && l !== undefined));
  const noteMean = (rs: Result[]) => mean(rs.map((r) => score(ev, r)?.note20).filter((n): n is number => n !== undefined));

  const sticky = { position: 'sticky' as const, background: 'var(--paper)' };
  // Colonne de moyennes (« Tous » ou une classe)
  const SumCell = ({ v, color, bold }: { v: number | null; color?: string; bold?: boolean }) => (
    <td style={{ textAlign: 'center', fontWeight: bold ? 900 : 800, background: color ?? overallColor(v, gc), borderLeft: '2px solid var(--ink)', borderRight: '2px solid var(--ink)', height: 26 }}>
      {v === null ? '' : Math.round(v * 100)}
    </td>
  );

  // Note /20 juste sous le nom (élève) ou sous la classe (moyenne), comme dans le tableur
  const NoteTag = ({ v, bold }: { v: number | null | undefined; bold?: boolean }) =>
    v === null || v === undefined ? (
      <span style={{ height: 20 }} />
    ) : (
      <span style={{ background: overallColor(v / 20, gc), borderRadius: 6, padding: '0 5px', fontSize: '0.8rem', fontWeight: bold ? 900 : 500, color: 'var(--ink)' }}>
        {round1(v)}
      </span>
    );

  return (
    <div className="panel stack">
      <span className="small muted">
        Même clavier que la correction copie par copie : <span className="code">1 2 3 4</span>, <span className="code">0</span> pour une valeur
        libre, flèches pour se déplacer (↑ ↓ question, ← → élève). Colonne « Tous » et colonne de chaque classe : réussite moyenne (%) ; cliquez sur
        une classe pour replier ou déplier ses élèves. Survol d'un élève : son appréciation.
      </span>
      <GradeColorsEditor />
      <div style={{ overflow: 'auto', maxHeight: '75vh' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th style={{ ...sticky, left: 0, top: 0, zIndex: 3, minWidth: 420, verticalAlign: 'bottom', textAlign: 'right', padding: '2px 8px 4px' }}>
                <b>Note /20</b>
              </th>
              <th style={{ ...sticky, top: 0, zIndex: 2, padding: '2px 4px', width: 52 }} title="Moyenne de tous les élèves">
                <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
                  <span className="chip" style={{ fontWeight: 900 }}>
                    Tous
                  </span>
                  <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
                    {all.length} copie(s)
                  </span>
                  <NoteTag v={noteMean(all)} bold />
                </div>
              </th>
              {byGroup.map(({ g, items }) => (
                <Fragment key={g.id}>
                  <th style={{ ...sticky, top: 0, zIndex: 2, padding: '2px 4px', width: 56 }}>
                    <button
                      type="button"
                      onClick={() => toggle(g.id)}
                      title={folded.has(g.id) ? 'Déplier les élèves de la classe' : 'Replier les élèves de la classe'}
                      className="stack"
                      style={{ alignItems: 'center', gap: 2, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}
                    >
                      <span className="chip cchip" style={{ background: g.color ?? 'var(--paper)', fontWeight: 900, whiteSpace: 'nowrap' }}>
                        {shortName(g.name)} <Icon name={folded.has(g.id) ? 'arrowRight' : 'arrowLeft'} size={12} />
                      </span>
                      <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
                        {folded.has(g.id) ? `${items.length} élèves` : 'moyenne'}
                      </span>
                      <NoteTag v={noteMean(rsOf(items))} bold />
                    </button>
                  </th>
                  {!folded.has(g.id) &&
                    items.map(({ student, si }) => (
                      <th key={student.id} style={{ ...sticky, top: 0, zIndex: 2, padding: 2, width: 46 }}>
                        <div
                          className="stack"
                          style={{ alignItems: 'center', gap: 2 }}
                          title={results.get(student.id)?.appreciation?.trim() || `${student.firstName} ${student.lastName} (pas d'appréciation)`}
                        >
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
                          {results.get(student.id)?.absent ? <span className="small muted">abs</span> : <NoteTag v={score(ev, results.get(student.id))?.note20} />}
                        </div>
                      </th>
                    ))}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {ev.criteria.map((c, ci) => (
              <tr key={c.id}>
                <td
                  style={{
                    ...sticky,
                    left: 0,
                    zIndex: 1,
                    padding: '2px 6px',
                    fontWeight: ci === cell[0] ? 900 : 600,
                    borderBottom: '1px solid var(--muted-line)',
                  }}
                >
                  {ci + 1}. {c.label} <span className="muted">({c.points})</span>
                </td>
                <SumCell v={critMean(all, c.id)} bold />
                {byGroup.map(({ g, items }) => (
                  <Fragment key={g.id}>
                    <SumCell v={critMean(rsOf(items), c.id)} />
                    {!folded.has(g.id) &&
                      items.map(({ student, si }) => {
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
                              background: r?.absent ? '#e9e5dc' : levelCellColor(l, gc),
                              outline: on ? '2.5px solid var(--ink)' : '1px solid var(--muted-line)',
                              outlineOffset: on ? -2 : -1,
                              height: 26,
                              fontWeight: 500,
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
                  </Fragment>
                ))}
              </tr>
            ))}
            {rows.map(({ c: k, sub }) => {
              const tone = (v: number | null) => overallColor(v, gc);
              const mAll = mean(present(list.map((x) => results.get(x.student.id))).map((r) => scoreOf(r, k)?.value).filter((v): v is number => v !== undefined));
              return (
                <tr key={k.id}>
                  <td
                    style={{ ...sticky, left: 0, padding: sub ? '2px 6px 2px 24px' : '4px 6px', fontWeight: sub ? 500 : 800, borderTop: sub ? undefined : '1px solid var(--muted-line)' }}
                    title={k.name}
                  >
                    <span style={{ background: k.color, borderRadius: 6, padding: '0 6px', fontWeight: 800 }}>{k.code}</span> {sub ? k.name : `${k.name} (%)`}
                  </td>
                  <SumCell v={mAll} color={tone(mAll)} bold />
                  {byGroup.map(({ g, items }) => {
                    const m = mean(rsOf(items).map((r) => scoreOf(r, k)?.value).filter((v): v is number => v !== undefined));
                    return (
                      <Fragment key={g.id}>
                        <SumCell v={m} color={tone(m)} />
                        {!folded.has(g.id) &&
                          items.map(({ student }) => {
                            const r = results.get(student.id);
                            const sc = r && !r.absent ? scoreOf(r, k) : undefined;
                            return (
                              <td
                                key={student.id}
                                title={sc ? `${k.code} ${k.name} : ${round1(sc.note)}/${round1(sc.total)} pts · ${masteryOf(sc.value).name}` : undefined}
                                style={{ textAlign: 'center', fontWeight: 500, fontSize: '0.8rem', background: sc ? overallColor(sc.value, gc) : undefined }}
                              >
                                {sc ? Math.round(sc.value * 100) : ''}
                              </td>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
