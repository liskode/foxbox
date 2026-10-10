// Une évaluation : barème, correction copie par copie, grille, résultats.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, SUBJECTS, type Criterion, type Evaluation, type Result, type Student } from '../../lib/db';
import {
  LEVELS,
  LEVEL_KEYS,
  FAIL_LEVEL,
  duplicate,
  emptyResult,
  levelColor,
  maxPoints,
  parseCriteria,
  resetCardsForFailures,
  round1,
  saveResult,
  score,
  stats,
  studentsOf,
  syncAllShares,
  dateFor,
  levelOfEval,
  createEvalSeance,
  variantOf,
  assignClass,
  pronoteColumn,
} from '../../lib/grading';
import { LEVELS as UNIT_LEVELS, levelOfName, nextSeanceCode, unitLabel } from '../../lib/units';
import { frDate } from '../../lib/dates';
import { Avatar } from '../../components/Avatar';
import { CardBrowser } from '../../components/CardBrowser';
import { NoteButton } from '../../components/StudentNote';
import { CompetencePicker } from '../../components/CompetencePicker';

const pct = (l: number | null | undefined) => (l === null || l === undefined ? '' : `${Math.round(l * 100)}`);
const isTyping = (t: EventTarget | null) => /INPUT|TEXTAREA|SELECT/.test((t as HTMLElement)?.tagName ?? '');

function parseLevel(s: string): number | null | undefined {
  const t = s.trim().replace(',', '.').replace('%', '');
  if (!t) return null;
  let v = parseFloat(t);
  if (Number.isNaN(v)) return undefined;
  if (v > 1) v = v / 100; // « 20 » ou « 20% » = 0,2
  return Math.max(0, Math.min(1, round1(v * 100) / 100));
}

// ---------------------------------------------------------------- Barème
function CardLink({ c, onChange }: { c: Criterion; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(c.cardIds ?? []));
  const n = c.cardIds?.length ?? 0;
  return (
    <>
      <button className={'btn small' + (n ? '' : ' ghost')} title="Cartes FoxBox liées à ce critère" onClick={() => (setSel(new Set(c.cardIds ?? [])), setOpen(true))}>
        🃏 {n || ''}
      </button>
      {open && (
        <>
          <div className="drawer-bg" onClick={() => setOpen(false)} />
          <aside className="drawer stack">
            <div className="spread" style={{ position: 'sticky', top: -20, background: 'var(--bg)', zIndex: 3, padding: '8px 0' }}>
              <div>
                <b>Cartes liées à « {c.label || 'critère'} »</b>
                <div className="small muted">Si un élève rate ce critère (≤ 25 %), ces cartes pourront revenir en boîte 1 pour lui.</div>
              </div>
              <div className="row">
                <button className="btn ghost" onClick={() => setOpen(false)}>
                  Annuler
                </button>
                <button className="btn primary" onClick={() => (onChange([...sel]), setOpen(false))}>
                  Valider ({sel.size})
                </button>
              </div>
            </div>
            <CardBrowser
              selected={sel}
              onToggle={(id) => {
                const s = new Set(sel);
                if (s.has(id)) s.delete(id);
                else s.add(id);
                setSel(s);
              }}
              onToggleMany={(ids, on) => {
                const s = new Set(sel);
                ids.forEach((i) => (on ? s.add(i) : s.delete(i)));
                setSel(s);
              }}
            />
          </aside>
        </>
      )}
    </>
  );
}

function BaremeTab({ ev, update }: { ev: Evaluation; update: (p: Partial<Evaluation>) => Promise<void> }) {
  const nav = useNavigate();
  const allGroups = useLiveQuery(() => db.groups.filter((g) => !g.archived).toArray(), [], []);
  const level = levelOfEval(ev, allGroups);
  // Seules les classes du niveau de l'évaluation sont proposées
  const groups = allGroups.filter((g) => !level || levelOfName(g.name) === level);
  const units = useLiveQuery(() => db.units.toArray(), [], []);
  const evUnit = units.find((u) => u.id === ev.unitId);
  const seqs = units
    .filter((u) => u.kind === 'sequence' && u.level === level)
    .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', 'fr', { numeric: true }));
  const [paste, setPaste] = useState('');

  async function setSequence(seqId: string) {
    if (!seqId) return update({ unitId: undefined });
    const seq = units.find((u) => u.id === seqId)!;
    if (evUnit) {
      if (evUnit.parentId === seqId) return;
      const n = units.filter((u) => u.parentId === seqId).length;
      await db.units.update(evUnit.id, { parentId: seqId, order: n + 1, code: await nextSeanceCode(seq), theme: seq.theme });
    } else await createEvalSeance(seq, ev);
  }
  const setCrit = (i: number, p: Partial<Criterion>) => update({ criteria: ev.criteria.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const move = (i: number, d: number) => {
    const list = [...ev.criteria];
    const [x] = list.splice(i, 1);
    list.splice(i + d, 0, x);
    update({ criteria: list });
  };

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="row">
          <label className="field" style={{ flex: 1, minWidth: 220 }}>
            Nom de l'évaluation
            <input value={ev.name} onChange={(e) => update({ name: e.target.value })} />
          </label>
          {ev.template && (
            <label className="field">
              Date
              <input type="date" value={ev.date} onChange={(e) => update({ date: e.target.value })} />
            </label>
          )}
          <label className="field">
            Niveau
            <select value={level ?? ''} onChange={(e) => update({ level: e.target.value || undefined })}>
              <option value="">—</option>
              {UNIT_LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          {level && (
            <label className="field" style={{ maxWidth: 280 }}>
              Séquence (Progression)
              <select value={evUnit?.parentId ?? ''} onChange={(e) => setSequence(e.target.value)}>
                <option value="">— aucune —</option>
                {seqs.map((q) => (
                  <option key={q.id} value={q.id}>
                    {unitLabel(q)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            Matière
            <select value={ev.subject} onChange={(e) => update({ subject: e.target.value })}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        {!ev.template && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="spread">
              <b className="small">Classes concernées{level ? ` (${level})` : ''}</b>
              <button
                className="btn small ghost"
                title="Copie de cette évaluation, à adapter pour d'autres classes du niveau"
                onClick={async () => {
                  const v = variantOf(ev);
                  await db.evaluations.put(v);
                  nav(`/prof/correction/${v.id}?onglet=bareme`);
                }}
              >
                + Créer une variante pour d'autres classes
              </button>
            </div>
            {ev.unitId && <span className="small muted">Une classe ne passe qu'une variante : la cocher ici la retire des autres variantes.</span>}
            <div className="row" style={{ gap: 6 }}>
              {groups
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
                .map((g) => {
                  const on = ev.groupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      className={'chip' + (on ? '' : ' off')}
                      style={{ background: g.color ?? 'var(--paper)' }}
                      onClick={() => assignClass(ev, g.id, !on)}
                    >
                      {on ? '✓ ' : ''}
                      {g.name}
                    </button>
                  );
                })}
            </div>
            {ev.groupIds.length > 0 && (
              <div className="row" style={{ gap: 12 }}>
                {groups
                  .filter((g) => ev.groupIds.includes(g.id))
                  .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
                  .map((g) => (
                    <label key={g.id} className="field" style={{ fontSize: '0.85rem' }}>
                      <span>
                        Date en <span style={{ background: g.color, borderRadius: 6, padding: '0 6px' }}>{g.name}</span>
                      </span>
                      <input
                        type="date"
                        value={dateFor(ev, g.id)}
                        onChange={async (e) => {
                          const next = { ...ev, groupDates: { ...(ev.groupDates ?? {}), [g.id]: e.target.value } };
                          await update({ groupDates: next.groupDates });
                          await syncAllShares(next);
                        }}
                      />
                    </label>
                  ))}
              </div>
            )}
          </div>
        )}
        <div className="stack" style={{ gap: 6 }}>
          <b className="small">Visible par les élèves dans leur espace</b>
          <div className="row">
            {(
              [
                ['note', 'Note'],
                ['appreciation', 'Appréciation'],
                ['detail', 'Barème détaillé (critère par critère)'],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="row small" style={{ gap: 6, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={ev.visibility[k]}
                  onChange={async (e) => {
                    const next = { ...ev, visibility: { ...ev.visibility, [k]: e.target.checked } };
                    await update({ visibility: next.visibility });
                    await syncAllShares(next);
                  }}
                />
                {l}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="panel stack">
        <div className="spread">
          <h3 style={{ margin: 0 }}>
            Barème : {ev.criteria.length} critère(s), {maxPoints(ev)} point(s)
          </h3>
          <button className="btn small" onClick={() => update({ criteria: [...ev.criteria, { id: uid(), label: '', points: 1 }] })}>
            + Critère
          </button>
        </div>
        <table className="list">
          <thead>
            <tr>
              <th>#</th>
              <th>Critère</th>
              <th>Points</th>
              <th>Cartes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ev.criteria.map((c, i) => (
              <tr key={c.id}>
                <td className="muted">{i + 1}</td>
                <td style={{ width: '70%' }}>
                  <input style={{ width: '100%' }} value={c.label} placeholder="Ex. Équilibrage 5 3 4" onChange={(e) => setCrit(i, { label: e.target.value })} />
                  <CompetencePicker value={c.competenceIds ?? []} onChange={(ids) => setCrit(i, { competenceIds: ids })} />
                </td>
                <td>
                  <input
                    style={{ width: 70 }}
                    type="number"
                    step="0.5"
                    min="0"
                    value={c.points}
                    onChange={(e) => setCrit(i, { points: Math.max(0, parseFloat(e.target.value) || 0) })}
                  />
                </td>
                <td>
                  <CardLink c={c} onChange={(ids) => setCrit(i, { cardIds: ids })} />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn small ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>{' '}
                  <button className="btn small ghost" disabled={i === ev.criteria.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </button>{' '}
                  <button
                    className="btn small ghost"
                    onClick={() => confirm(`Supprimer le critère « ${c.label} » ?`) && update({ criteria: ev.criteria.filter((x) => x.id !== c.id) })}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <details>
          <summary className="small" style={{ fontWeight: 700, cursor: 'pointer' }}>
            Coller une liste de critères (depuis Excel ou un texte)
          </summary>
          <div className="stack" style={{ marginTop: 8 }}>
            <span className="small muted">Une ligne par critère. Si la ligne se termine par un nombre (colonne Excel ou « ; 2 »), il devient le barème ; sinon 1 point.</span>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Bilan en toutes lettres\t1\nÉquilibrage 5 3 4\t2'} />
            <div>
              <button
                className="btn small primary"
                disabled={!paste.trim()}
                onClick={async () => {
                  await update({ criteria: [...ev.criteria, ...parseCriteria(paste)] });
                  setPaste('');
                }}
              >
                Ajouter ces critères
              </button>
            </div>
          </div>
        </details>
      </div>

      <div className="row">
        {!ev.template && (
          <button
            className="btn ghost"
            onClick={async () => {
              const t = { ...duplicate(ev), template: true, groupIds: [], groupDates: {}, unitId: undefined, name: ev.name };
              await db.evaluations.put(t);
              alert('Modèle enregistré : il apparaît dans la liste des modèles de l’onglet Correction.');
            }}
          >
            Enregistrer comme modèle
          </button>
        )}
        <button
          className="btn danger"
          onClick={async () => {
            if (!confirm(`Supprimer « ${ev.name} » et toutes ses corrections ?`)) return;
            const rs = await db.results.where('evaluationId').equals(ev.id).primaryKeys();
            await db.resultShares.bulkDelete(rs);
            await db.results.bulkDelete(rs);
            await db.evaluations.delete(ev.id);
            nav('/prof/correction');
          }}
        >
          Supprimer l'évaluation
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Correction copie par copie
function useResults(ev: Evaluation) {
  const list = useLiveQuery(() => studentsOf(ev), [ev.groupIds.join()], []);
  const results = useLiveQuery(
    async () => new Map((await db.results.where('evaluationId').equals(ev.id).toArray()).map((r) => [r.studentId, r])),
    [ev.id],
    new Map<string, Result>(),
  );
  return { list, results };
}

function NoteBadge({ ev, r }: { ev: Evaluation; r?: Result }) {
  const s = score(ev, r);
  if (r?.absent) return <span className="chip">Absent</span>;
  if (!s) return <span className="muted small">—</span>;
  return (
    <span style={{ fontWeight: 900 }}>
      {s.note}/{s.total} <span className="muted small">· {s.note20}/20</span>
    </span>
  );
}

function CopiesTab({ ev }: { ev: Evaluation }) {
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
                {student.lastName} {student.firstName}
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
                {cur.student.firstName} {cur.student.lastName}
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
            <button className={'btn small' + (r.absent ? ' danger' : ' ghost')} onClick={() => saveResult(ev, { ...r, absent: !r.absent })}>
              {r.absent ? 'Absent ✓' : 'Absent (A)'}
            </button>
            <NoteButton student={cur.student} />
          </div>
        </div>

        <div className="panel stack" style={{ gap: 4, opacity: r.absent ? 0.4 : 1 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>
            Touches : <span className="code">/ 1 2 3 4</span> = 0 · 25 · 50 · 75 · 100 % (puis question suivante) ·{' '}
            <span className="code">0</span> ou <span className="code">,</span> = saisie libre (0,2…) · ↑ ↓ question · Effacer = non noté
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
          <span className="small muted">Enregistrée en quittant le champ. {ev.visibility.appreciation ? 'Visible par l’élève.' : 'Non visible par l’élève.'}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Grille (comme le tableur : critères en lignes, élèves en colonnes)
function GrilleTab({ ev }: { ev: Evaluation }) {
  const { list, results } = useResults(ev);
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
        Même clavier que la correction copie par copie : <span className="code">/ 1 2 3 4</span>, <span className="code">0</span> pour une
        valeur libre, flèches pour se déplacer (↑ ↓ question, ← → élève).
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
                    <span style={{ fontSize: '0.65rem', fontWeight: si === cell[1] ? 900 : 600, maxWidth: 46, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                <td style={{ position: 'sticky', left: 0, background: 'var(--paper)', zIndex: 1, padding: '2px 6px', fontWeight: ci === cell[0] ? 900 : 600, borderBottom: '1px solid var(--muted-line)' }}>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Résultats
function ResultatsTab({ ev }: { ev: Evaluation }) {
  const { list, results } = useResults(ev);
  const groups = useLiveQuery(() => db.groups.bulkGet(ev.groupIds), [ev.groupIds.join()], []);
  const [msg, setMsg] = useState('');
  const linked = ev.criteria.some((c) => c.cardIds?.length);

  const byGroup = useMemo(
    () =>
      ev.groupIds.map((gid) => {
        const members = list.filter((x) => x.groupId === gid);
        const rs = members.map((m) => results.get(m.student.id));
        const notes = rs.map((r) => score(ev, r)?.note20).filter((x): x is number => x !== undefined);
        const absents = rs.filter((r) => r?.absent).length;
        const crit = ev.criteria.map((c) => {
          const ls = rs.map((r) => (r && !r.absent ? r.levels[c.id] : undefined)).filter((x): x is number => x !== null && x !== undefined);
          return ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : null;
        });
        return { gid, members, notes, absents, stat: stats(notes), crit };
      }),
    [ev, list, results],
  );

  function exportCsv() {
    const rows = [['Classe', 'Nom', 'Prénom', `Note /${maxPoints(ev)}`, 'Note /20', 'Absent', 'Appréciation']];
    for (const { student, groupId } of list) {
      const r = results.get(student.id);
      const s = score(ev, r);
      const g = groups.find((x) => x?.id === groupId);
      rows.push([g?.name ?? '', student.lastName, student.firstName, s ? String(s.note).replace('.', ',') : '', s ? String(s.note20).replace('.', ',') : '', r?.absent ? 'ABS' : '', (r?.appreciation ?? '').replace(/\s+/g, ' ')]);
    }
    const csv = '﻿' + rows.map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${ev.name} - notes.csv`;
    a.click();
  }

  return (
    <div className="stack">
      <div className="row">
        <button className="btn" onClick={exportCsv}>
          ⬇ Exporter les notes (CSV pour Pronote / Excel)
        </button>
        {linked && (
          <button
            className="btn primary"
            onClick={async () => {
              if (!confirm('Remettre en boîte 1 (à revoir dès aujourd’hui) les cartes liées aux critères ratés (≤ 25 %), pour chaque élève concerné ?')) return;
              const r = await resetCardsForFailures(ev);
              setMsg(`${r.cards} carte(s) remise(s) en boîte 1 pour ${r.students} élève(s).`);
            }}
          >
            🃏 Remettre en boîte 1 les cartes des critères ratés
          </button>
        )}
      </div>
      {msg && <div className="notice">{msg}</div>}
      {byGroup.map(({ gid, members, absents, stat, crit, notes }) => {
        const g = groups.find((x) => x?.id === gid);
        const bins = [0, 0, 0, 0, 0]; // 0-4, 4-8, 8-12, 12-16, 16-20
        notes.forEach((n) => bins[Math.min(4, Math.floor(n / 4))]++);
        const maxBin = Math.max(1, ...bins);
        return (
          <div key={gid} className="panel stack">
            <div className="spread">
              <h2 style={{ margin: 0 }}>
                <span style={{ background: g?.color, borderRadius: 10, padding: '0 8px' }}>{g?.name}</span>{' '}
                <span className="small muted" style={{ fontWeight: 600 }}>
                  {frDate(dateFor(ev, gid))}
                </span>
              </h2>
              <button
                className="btn small"
                title="Notes sur 20, une par ligne, dans l'ordre alphabétique : cliquez dans la première case de la colonne Pronote puis collez (Cmd+V)"
                onClick={async () => {
                  await navigator.clipboard.writeText(pronoteColumn(ev, list, results, gid));
                  setMsg(`Notes de ${g?.name} copiées (${members.length} élèves, ordre alphabétique, sur 20, « Abs » pour les absents). Dans Pronote, cliquez sur la case du premier élève puis collez.`);
                }}
              >
                📋 Copier les notes pour Pronote
              </button>
            </div>
            <div className="grid3">
              <div>
                <div className="muted small">Moyenne (absents exclus)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{stat ? `${stat.mean}/20` : '—'}</div>
                {stat && (
                  <div className="small muted">
                    écart type {stat.sd} · min {stat.min} · max {stat.max} · {stat.n} copie(s) · {absents} absent(s) · {members.length - stat.n - absents} non corrigée(s)
                  </div>
                )}
              </div>
              <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 90 }}>
                {bins.map((b, i) => (
                  <div key={i} className="stack" style={{ alignItems: 'center', gap: 2, flex: 1 }}>
                    <span className="small">{b}</span>
                    <div style={{ width: '100%', height: (b / maxBin) * 60 + 2, background: 'var(--turquoise)', border: '2px solid var(--line)', borderRadius: 4 }} />
                    <span className="small muted">
                      {i * 4}–{i * 4 + 4}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <details open>
              <summary style={{ fontWeight: 800, cursor: 'pointer' }}>Réussite par critère</summary>
              <table className="list" style={{ marginTop: 6 }}>
                <tbody>
                  {ev.criteria.map((c, i) => {
                    const v = crit[i];
                    return (
                      <tr key={c.id}>
                        <td style={{ width: '60%' }}>
                          {i + 1}. {c.label}
                          {c.cardIds?.length ? <span className="small muted"> · 🃏{c.cardIds.length}</span> : null}
                        </td>
                        <td>
                          {v === null ? (
                            <span className="muted small">—</span>
                          ) : (
                            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                              <div style={{ width: 140, height: 12, border: '2px solid var(--line)', borderRadius: 6, overflow: 'hidden', background: 'var(--paper)' }}>
                                <div style={{ width: `${v * 100}%`, height: '100%', background: v <= FAIL_LEVEL ? 'var(--forgot)' : v < 0.6 ? 'var(--hard)' : 'var(--easy)' }} />
                              </div>
                              <b>{Math.round(v * 100)} %</b>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
            <details>
              <summary style={{ fontWeight: 800, cursor: 'pointer' }}>Notes des élèves</summary>
              <table className="list" style={{ marginTop: 6 }}>
                <tbody>
                  {members.map(({ student }) => {
                    const r = results.get(student.id);
                    return (
                      <tr key={student.id}>
                        <td>
                          <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                            <Avatar student={student} size={28} zoom />
                            <Link to={`/prof/correction/${ev.id}?onglet=copies&eleve=${student.id}`}>
                              {student.lastName} {student.firstName}
                            </Link>
                          </span>
                        </td>
                        <td>
                          <NoteBadge ev={ev} r={r} />
                        </td>
                        <td className="small muted" style={{ maxWidth: 360 }}>
                          {r?.appreciation}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Page
export function EvaluationPage() {
  const { id } = useParams();
  const ev = useLiveQuery(async () => (await db.evaluations.get(id!)) ?? null, [id]);
  const [params, setParams] = useSearchParams();
  type Tab = 'bareme' | 'copies' | 'grille' | 'resultats';
  const tab = (params.get('onglet') as Tab) || 'copies';
  if (ev === undefined) return null;
  if (!ev) return <div className="page muted">Évaluation introuvable.</div>;
  const update = async (p: Partial<Evaluation>) => {
    await db.evaluations.put({ ...ev, ...p });
  };
  const tabs: [Tab, string][] = ev.template
    ? [['bareme', 'Barème']]
    : [
        ['bareme', 'Barème et réglages'],
        ['copies', 'Copie par copie'],
        ['grille', 'Grille'],
        ['resultats', 'Résultats'],
      ];
  const current = ev.template ? 'bareme' : tab;

  return (
    <div className={'page stack' + (current === 'grille' ? ' wide' : '')}>
      <div className="spread">
        <div>
          <Link to="/prof/correction" className="small muted">
            ← Évaluations
          </Link>
          <h1 className="title" style={{ margin: 0 }}>
            {ev.name}
            {ev.template && <span className="chip" style={{ fontFamily: 'var(--font)', marginLeft: 8, verticalAlign: 'middle' }}>modèle</span>}
          </h1>
          <div className="muted small">
            {ev.criteria.length} critère(s) · {maxPoints(ev)} point(s)
          </div>
        </div>
        <nav className="nav" style={{ flex: 'none' }}>
          {tabs.map(([k, l]) => (
            <a key={k} href="#" className={current === k ? 'active' : ''} onClick={(e) => (e.preventDefault(), setParams({ onglet: k }, { replace: true }))}>
              {l}
            </a>
          ))}
        </nav>
      </div>
      {current === 'bareme' && <BaremeTab ev={ev} update={update} />}
      {current === 'copies' && <CopiesTab ev={ev} />}
      {current === 'grille' && <GrilleTab ev={ev} />}
      {current === 'resultats' && <ResultatsTab ev={ev} />}
    </div>
  );
}

export type { Student };
