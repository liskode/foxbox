// Évaluation : onglet Barème et réglages (critères, compétences, flashcards liées, classes, visibilité).
import { alertBox, askForm, confirmBox } from '../../../components/Dialog';
import { toast } from '../../../components/Toast';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isClass, uid, SUBJECTS, type Criterion, type Evaluation, type Unit, shortName } from '../../../lib/db';
import {
  duplicate,
  maxPoints,
  parseCriteria,
  syncAllShares,
  dateFor,
  levelOfEval,
  createEvalSeance,
  variantOf,
  assignClass,
  evalFromTemplate,
} from '../../../lib/grading';
import { LEVELS as UNIT_LEVELS, levelOfName, nextSeanceCode, unitLabel, unitSubject, byProgression } from '../../../lib/units';
import { CardBrowser } from '../../../components/CardBrowser';
import { CompetencePicker } from '../../../components/CompetencePicker';
import { DocumentsEditor } from '../../../components/UnitDetails';
import { Icon } from '../../../components/Icon';
import { LazyInput } from '../../../components/LazyInput';

// ---------------------------------------------------------------- Barème
function CardLink({ c, onChange }: { c: Criterion; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(c.cardIds ?? []));
  const n = c.cardIds?.length ?? 0;
  return (
    <>
      <button
        className={'btn small' + (n ? '' : ' ghost')}
        title="Flashcards FoxBox liées à ce critère"
        onClick={() => (setSel(new Set(c.cardIds ?? [])), setOpen(true))}
      >
        <Icon name="cards" size={15} /> {n || ''}
      </button>
      {open && (
        <>
          <div className="drawer-bg" onClick={() => setOpen(false)} />
          <aside className="drawer stack">
            <div className="spread" style={{ position: 'sticky', top: -20, background: 'var(--bg)', zIndex: 3, padding: '8px 0' }}>
              <div>
                <b>Flashcards liées à « {c.label || 'critère'} »</b>
                <div className="small muted">Si un élève rate ce critère, ces flashcards pourront reculer pour lui : retour en boîte 1 à 0 %, une boîte en arrière à 40 %.</div>
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

// RES (restituer ses connaissances) : séances ou séquences de la progression que le critère demande de restituer
function RestoreUnits({ value, seqs, units, onChange }: { value: string[]; seqs: Unit[]; units: Unit[]; onChange: (ids: string[]) => void }) {
  const byId = new Map(units.map((u) => [u.id, u]));
  return (
    <div className="row small" style={{ gap: 4, marginTop: 4 }}>
      <span className="muted">À restituer :</span>
      {value.map((id) => {
        const u = byId.get(id);
        return (
          <span key={id} className="tag plain">
            {u ? unitLabel(u) : '(supprimée)'}
            <button type="button" className="btn small ghost" style={{ border: 'none', padding: 0 }} title="Retirer" onClick={() => onChange(value.filter((x) => x !== id))}>
              <Icon name="x" size={11} />
            </button>
          </span>
        );
      })}
      <select value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} style={{ maxWidth: 260 }}>
        <option value="">{value.length ? '+ autre séance…' : 'choisir la séance ou la séquence…'}</option>
        {seqs.map((q) => (
          <optgroup key={q.id} label={unitLabel(q)}>
            {[q, ...units.filter((u) => u.parentId === q.id && !u.isEval).sort(byProgression)]
              .filter((u) => !value.includes(u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id === q.id ? `${unitLabel(u)} (séquence entière)` : unitLabel(u)}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {!seqs.length && <span className="muted">(choisissez le niveau de l'évaluation pour voir la progression)</span>}
    </div>
  );
}

export function BaremeTab({ ev, update }: { ev: Evaluation; update: (p: Partial<Evaluation>) => Promise<void> }) {
  const nav = useNavigate();
  const allGroups = useLiveQuery(() => db.groups.filter((g) => !g.archived && isClass(g)).toArray(), [], []);
  const level = levelOfEval(ev, allGroups);
  // Seules les classes du niveau de l'évaluation sont proposées
  const groups = allGroups.filter((g) => !level || levelOfName(g.name) === level);
  const units = useLiveQuery(() => db.units.toArray(), [], []);
  const evUnit = units.find((u) => u.id === ev.unitId);
  const seqs = units.filter((u) => u.kind === 'sequence' && u.level === level).sort(byProgression);
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
  // Modèle : la classe cochée reçoit sa propre évaluation, placée dans la Progression ; on continue sur celle-ci
  async function fromTemplate(groupId: string) {
    let seq = seqs.find((q) => q.id === ev.seqId);
    if (!seq && seqs.length) {
      const r = await askForm(
        'Séquence de la Progression',
        [{ key: 'seq', label: 'Placer l’évaluation à la fin de la séquence', value: seqs[seqs.length - 1].id, options: seqs.map((q) => ({ value: q.id, label: unitLabel(q) })) }],
        'Créer l’évaluation',
      );
      if (!r) return;
      seq = seqs.find((q) => q.id === r.seq);
      await update({ seqId: seq?.id });
    }
    const { ev: created, undo } = await evalFromTemplate(ev, groupId, seq);
    const g = groups.find((x) => x.id === groupId);
    toast(`Évaluation créée pour ${g ? shortName(g.name) : 'la classe'}${seq ? ` dans ${unitLabel(seq)}` : ''}`, {
      undo: async () => {
        await undo();
        nav(`/prof/correction/${ev.id}?onglet=bareme`);
      },
    });
    nav(`/prof/correction/${created.id}?onglet=bareme`);
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
            <LazyInput value={ev.name} onSave={(name) => update({ name })} />
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
              <select
                value={(ev.template ? ev.seqId : evUnit?.parentId) ?? ''}
                onChange={(e) => (ev.template ? update({ seqId: e.target.value || undefined }) : setSequence(e.target.value))}
              >
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
        {ev.template && (
          <div className="stack" style={{ gap: 6 }}>
            <b className="small">Classes{level ? ` (${level})` : ''}</b>
            <span className="small muted">Choisir des classes pour ajouter ce modèle à la progression.</span>
            <div className="row" style={{ gap: 6 }}>
              {groups
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
                .map((g) => (
                  <button key={g.id} className="chip cchip off" style={{ background: g.color ?? 'var(--paper)' }} onClick={() => fromTemplate(g.id)}>
                    {shortName(g.name)}
                  </button>
                ))}
            </div>
          </div>
        )}
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
                      className={'chip cchip' + (on ? '' : ' off')}
                      style={{ background: g.color ?? 'var(--paper)' }}
                      onClick={() => assignClass(ev, g.id, !on)}
                    >
                      {on && <><Icon name="check" size={14} /> </>}
                      {shortName(g.name)}
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
                        Date en <span style={{ background: g.color, borderRadius: 6, padding: '0 6px' }}>{shortName(g.name)}</span>
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
                      {ev.visibility.selfCheck && (
                        <span className="row small" style={{ gap: 6, fontWeight: 700 }}>
                          <input
                            type="checkbox"
                            checked={!!ev.returned?.[g.id]}
                            onChange={async (e) => {
                              const next = { ...ev, returned: { ...(ev.returned ?? {}), [g.id]: e.target.checked } };
                              await update({ returned: next.returned });
                              await syncAllShares(next);
                            }}
                          />
                          Copies rendues
                        </span>
                      )}
                    </label>
                  ))}
              </div>
            )}
          </div>
        )}
        <DocumentsEditor label="Sujet, corrigé (PDF, pour vous)" docs={ev.documents ?? []} onChange={(documents) => update({ documents })} />
        <div className="stack" style={{ gap: 6 }}>
          <b className="small">Visible par les élèves dans leur espace</b>
          <div className="row">
            {(
              [
                ['note', 'Note'],
                ['appreciation', 'Appréciation'],
                ['detail', 'Barème détaillé (critère par critère)'],
                ['competences', 'Histogramme par compétence'],
                ['selfCheck', 'Autocorrection'],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="row small" style={{ gap: 6, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={ev.visibility[k] ?? k !== 'selfCheck'}
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
          {ev.visibility.selfCheck && (
            <span className="small muted">
              Autocorrection : quand vous cochez « Copies rendues » pour sa classe, l'élève note lui-même sa copie critère par critère (copie sous les yeux).
              Il ne voit les éléments cochés ci-dessus (note, appréciation…) qu'une fois son autocorrection terminée.
            </span>
          )}
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
              <th>Flashcards</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ev.criteria.map((c, i) => (
              <tr key={c.id}>
                <td className="muted">{i + 1}</td>
                <td style={{ width: '70%' }}>
                  <LazyInput style={{ width: '100%' }} value={c.label} placeholder="Ex. Équilibrage 5 3 4" onSave={(label) => setCrit(i, { label })} />
                  <CompetencePicker value={c.competenceIds ?? []} onChange={(ids) => setCrit(i, { competenceIds: ids })} />
                  {c.competenceIds?.includes('APP') && (
                    <RestoreUnits value={c.unitIds ?? []} seqs={seqs.filter((q) => unitSubject(q) === ev.subject)} units={units} onChange={(unitIds) => setCrit(i, { unitIds })} />
                  )}
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
                    onClick={async () => (await confirmBox(`Supprimer le critère « ${c.label} » ?`)) && update({ criteria: ev.criteria.filter((x) => x.id !== c.id) })}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Même bouton en bas de la liste : pas besoin de remonter quand il y a beaucoup de critères */}
        {ev.criteria.length >= 3 && (
          <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => update({ criteria: [...ev.criteria, { id: uid(), label: '', points: 1 }] })}>
            + Critère
          </button>
        )}
        <details>
          <summary className="small" style={{ fontWeight: 700, cursor: 'pointer' }}>
            Coller une liste de critères (depuis Excel ou un texte)
          </summary>
          <div className="stack" style={{ marginTop: 8 }}>
            <span className="small muted">
              Une ligne par critère. Si la ligne se termine par un nombre (colonne Excel ou « ; 2 »), il devient le barème ; sinon 1 point.
            </span>
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
              const t = { ...duplicate(ev), template: true, groupIds: [], groupDates: {}, unitId: undefined, seqId: evUnit?.parentId, name: ev.name };
              await db.evaluations.put(t);
              alertBox('Modèle enregistré : il apparaît dans la liste des modèles de l’onglet Correction.');
            }}
          >
            Enregistrer comme modèle
          </button>
        )}
        <button
          className="btn danger"
          onClick={async () => {
            if (!(await confirmBox(`Supprimer « ${ev.name} » et toutes ses corrections ?`))) return;
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
