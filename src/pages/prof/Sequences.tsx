import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, nextCardCode, SUBJECTS, type Group, type Unit } from '../../lib/db';
import { THEMES as CARD_THEMES } from '../../lib/apkg';
import { CardBrowser } from '../../components/CardBrowser';
import { CardDetail } from '../../components/CardDetail';
import { CardFace } from '../../components/CardFace';
import { themeColor } from '../../components/widgets';
import { unitLabel, nextSequenceCode, nextSeanceCode, themesFor, themeLabel, levelColors, moveUnit, canMove } from '../../lib/units';
import { levelPlans, sequencesOf, finishedByAll, doneDate, durationOf, dm, type ClassPlan, type LevelPlan } from '../../lib/forecast';
import type { Timetable } from '../../lib/timetable';
import { DoneCell } from '../../components/DoneCell';
import { useAuth } from '../../lib/auth';
import { UnitDetails } from '../../components/UnitDetails';

function SequenceScreen({ seqId }: { seqId: string }) {
  const units = useLiveQuery(() => db.units.toArray(), [], []);
  const nav = useNavigate();
  const [hideDone, setHideDone] = useHideDone();
  const data = usePlans();
  const { session } = useAuth();
  const colors = useLiveQuery(() => levelColors(session!.id), [session], {} as Record<string, string>);
  const bgOf = (u: Unit) => (u.level && colors[u.level]) || 'var(--paper)';
  const [sel, setSel] = useState<string | null>(seqId);
  useEffect(() => setSel(seqId), [seqId]);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const unit = units.find((u) => u.id === sel);

  const cardsInUnit = useLiveQuery(async () => {
    if (!unit) return [];
    const ids = [unit.id, ...units.filter((u) => u.parentId === unit.id).map((u) => u.id)];
    const links = await db.unitCards.where('unitId').anyOf(ids).toArray();
    const cards = await db.cards.bulkGet([...new Set(links.map((l) => l.cardId))]);
    return cards
      .filter((c) => c && !c.deleted)
      .map((c) => ({ card: c!, own: links.some((l) => l.cardId === c!.id && l.unitId === unit.id) }))
      .sort((a, b) => a.card.code.localeCompare(b.card.code));
  }, [sel, units]);

  // Écran d'un niveau : seules ses séquences sont listées (on peut masquer celles terminées par toutes les classes)
  const lvl = units.find((u) => u.id === seqId)?.level ?? '';
  const lp = data?.levels.find((l) => l.level === lvl);
  const seqs = sequencesOf(units, lvl).filter(
    (q) => !hideDone || !lp || q.id === seqId || !finishedByAll(lp, lp.items.filter((it) => it.seq.id === q.id)),
  );
  // On ne déplie que la séquence en cours (sinon la liste devient très longue)
  const openSeq = unit?.kind === 'sequence' ? unit.id : unit?.parentId;

  async function addSequence() {
    const u = await createSequence(lvl, units);
    if (u) setSel(u.id);
  }

  async function addSeance(parent: Unit) {
    const n = units.filter((u) => u.parentId === parent.id).length + 1;
    const name = prompt('Titre de la séance');
    if (!name) return;
    const code = await nextSeanceCode(parent);
    const u: Unit = { id: uid(), kind: 'seance', parentId: parent.id, subject: parent.subject, level: parent.level, theme: parent.theme, name, order: n, code };
    await db.units.put(u);
    setSel(u.id);
  }

  async function rename(u: Unit) {
    const name = prompt('Nouveau nom', u.name);
    if (name) await db.units.update(u.id, { name });
  }

  async function remove(u: Unit) {
    if (!confirm(`Supprimer « ${u.name} » ? Les cartes elles-mêmes ne sont pas supprimées.`)) return;
    const ids = [u.id, ...units.filter((x) => x.parentId === u.id).map((x) => x.id)];
    await db.unitCards.where('unitId').anyOf(ids).delete();
    await db.publications.where('unitId').anyOf(ids).delete();
    await db.units.bulkDelete(ids);
    if (u.kind === 'sequence') nav('/prof/progression');
    else setSel(u.parentId!);
  }

  // Nouvelle carte créée directement dans la séquence / séance, avec le niveau et le thème déjà renseignés
  const [creating, setCreating] = useState<string | null>(null);
  const movable = useLiveQuery(async () => (unit ? canMove(unit) : undefined), [unit?.id, units]);
  async function newCard(u: Unit) {
    const now = Date.now();
    const id = uid();
    const theme = u.level !== '6e' && u.theme ? CARD_THEMES[u.theme] : undefined;
    await db.cards.put({
      id,
      code: await nextCardCode(),
      subject: u.subject,
      level: u.level,
      theme,
      tags: [u.level, theme].filter(Boolean) as string[],
      front: '',
      back: '',
      createdAt: now,
      updatedAt: now,
      ocrDone: true,
    });
    await db.unitCards.put({ id: `${u.id}|${id}`, unitId: u.id, cardId: id });
    setCreating(id);
    setOpen(id);
  }

  async function addPicked() {
    if (!unit) return;
    await db.unitCards.bulkPut([...picked].map((cardId) => ({ id: `${unit.id}|${cardId}`, unitId: unit.id, cardId })));
    setPicked(new Set());
    setPicking(false);
  }

  const togglePick = (id: string) => {
    const n = new Set(picked);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setPicked(n);
  };

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 20, alignItems: 'start' }}>
        <div className="panel stack" style={{ position: 'sticky', top: 80, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
          <div className="spread">
            <h2 style={{ margin: 0, background: colors[lvl], borderRadius: 10, padding: '0 10px' }}>{lvl}</h2>
            <button className="btn small primary" onClick={addSequence}>
              + Séquence
            </button>
          </div>
          <div className="spread">
            <Link to="/prof/progression" className="small">
              ← Tous les niveaux
            </Link>
            <HideDoneToggle value={hideDone} onChange={setHideDone} />
          </div>
          {!seqs.length && <span className="muted small">Créez votre première séquence.</span>}
          {seqs.map((s, i) => (
            <div key={s.id} className="stack" style={{ gap: 4 }}>
              {(i === 0 || seqs[i - 1].theme !== s.theme) && (
                <div className="small" style={{ fontWeight: 900, marginTop: i ? 8 : 0, color: 'var(--ink-soft)' }}>
                  {themeLabel(s.theme, s.level)}
                </div>
              )}
              <button
                className={'btn' + (sel === s.id ? ' primary' : ' ghost')}
                style={{
                  justifyContent: 'flex-start',
                  whiteSpace: 'normal',
                  textAlign: 'left',
                  // couleur du niveau ; la séquence sélectionnée reste jaune
                  ...(sel === s.id ? {} : { background: bgOf(s) }),
                }}
                onClick={() => {
                  setSel(s.id);
                  setPicking(false);
                }}
              >
                {unitLabel(s)}
              </button>
              {units
                .filter((u) => u.parentId === s.id && openSeq === s.id)
                .sort((a, b) => a.order - b.order)
                .map((se) => (
                  <button
                    key={se.id}
                    className={'btn small' + (sel === se.id ? ' primary' : ' ghost')}
                    style={{
                      marginLeft: 18,
                      justifyContent: 'flex-start',
                      whiteSpace: 'normal',
                      textAlign: 'left',
                      ...(sel === se.id ? {} : { background: bgOf(se) }),
                    }}
                    onClick={() => {
                      setSel(se.id);
                      setPicking(false);
                    }}
                  >
                    {unitLabel(se)}
                  </button>
                ))}
            </div>
          ))}
        </div>

        <div className="stack">
          {!unit ? (
            <div className="panel">
              <h1 className="title">Séquences et séances</h1>
              <p>
                Créez une séquence, découpez-la éventuellement en séances, puis ajoutez-y des cartes en les choisissant dans
                la liste filtrable. Le jour où vous avez traité la séquence (ou la séance) en classe, publiez-la : les cartes
                arrivent dans les révisions des élèves.
              </p>
            </div>
          ) : (
            <>
              <div className="spread">
                <div>
                  <div className="muted small" style={{ fontWeight: 800 }}>
                    {unit.kind === 'sequence' ? 'SÉQUENCE' : 'SÉANCE · ' + unitLabel(units.find((u) => u.id === unit.parentId) ?? { name: '' })}
                  </div>
                  <h1 className="title" style={{ margin: 0 }}>{unitLabel(unit)}</h1>
                </div>
                <div className="row">
                  {unit.kind === 'sequence' && (
                    <button className="btn" onClick={() => addSeance(unit)}>
                      + Séance
                    </button>
                  )}
                  <button className="btn ghost" disabled={!movable?.up} title="Monter (les codes sont renumérotés)" onClick={() => moveUnit(unit, -1)}>
                    ↑
                  </button>
                  <button className="btn ghost" disabled={!movable?.down} title="Descendre (les codes sont renumérotés)" onClick={() => moveUnit(unit, 1)}>
                    ↓
                  </button>
                  <button className="btn ghost" onClick={() => rename(unit)}>
                    Renommer
                  </button>
                  <button className="btn danger" onClick={() => remove(unit)}>
                    Supprimer
                  </button>
                </div>
              </div>

              <UnitDetails unit={unit} />
              {data && lp && (
                <ClassProgress
                  seq={unit.kind === 'sequence' ? unit : units.find((u) => u.id === unit.parentId)!}
                  lp={lp}
                  tt={data.tt}
                  selected={unit.id}
                  onSelect={setSel}
                  hideDone={hideDone}
                />
              )}

              {picking ? (
                <div className="stack">
                  <div className="spread panel" style={{ position: 'sticky', top: 70, zIndex: 5 }}>
                    <b>Cochez les cartes à ajouter à « {unit.name} »</b>
                    <div className="row">
                      <button className="btn ghost" onClick={() => setPicking(false)}>
                        Annuler
                      </button>
                      <button className="btn primary" disabled={!picked.size} onClick={addPicked}>
                        Ajouter {picked.size} carte(s)
                      </button>
                    </div>
                  </div>
                  <CardBrowser
                    selected={picked}
                    onToggle={togglePick}
                    onToggleMany={(ids, on) => {
                      const n = new Set(picked);
                      ids.forEach((i) => (on ? n.add(i) : n.delete(i)));
                      setPicked(n);
                    }}
                    onOpen={(c) => setOpen(c.id)}
                    exclude={new Set(cardsInUnit?.filter((x) => x.own).map((x) => x.card.id))}
                  />
                </div>
              ) : (
                <div className="panel stack">
                  <div className="spread">
                    <h3 style={{ margin: 0 }}>{cardsInUnit?.length ?? 0} carte(s)</h3>
                    <div className="row">
                    <button className="btn" onClick={() => newCard(unit)}>
                      + Nouvelle carte
                    </button>
                    <button className="btn primary" onClick={() => setPicking(true)}>
                      + Ajouter des cartes
                    </button>
                    </div>
                  </div>
                  <div className="cardgrid">
                    {cardsInUnit?.map(({ card, own }) => (
                      <div key={card.id} className="thumb" onClick={() => setOpen(card.id)}>
                        <div className="bar" style={{ background: themeColor(card.theme) }} />
                        <div className="face">
                          <CardFace html={card.front} />
                        </div>
                        <div className="meta">
                          <span className="code">{card.code}</span>
                          {own ? (
                            <button
                              className="btn small ghost"
                              title="Retirer de cette séquence"
                              onClick={(e) => {
                                e.stopPropagation();
                                db.unitCards.delete(`${unit.id}|${card.id}`);
                              }}
                            >
                              Retirer
                            </button>
                          ) : (
                            <span className="muted small">via séance</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {open && <CardDetail cardId={open} startEditing={creating === open} onClose={() => (setOpen(null), setCreating(null))} />}
    </div>
  );
}

// « Masquer ce qui est terminé » : préférence gardée dans le navigateur
function useHideDone(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    try {
      return localStorage.getItem('foxbox-hide-done') === '1';
    } catch {
      return false;
    }
  });
  return [
    v,
    (x: boolean) => {
      setV(x);
      try {
        localStorage.setItem('foxbox-hide-done', x ? '1' : '0');
      } catch {
        /* navigation privée */
      }
    },
  ];
}

function HideDoneToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row small" style={{ gap: 6, fontWeight: 700 }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      Masquer ce qui est terminé
    </label>
  );
}

function usePlans() {
  const { session } = useAuth();
  return useLiveQuery(() => levelPlans(session!.id), [session?.id]);
}

async function createSequence(level: string, units: Unit[]) {
  const names = themesFor(level);
  const theme = prompt(`Nouvelle séquence de ${level}. Thème :\n${Object.entries(names).map(([k, v]) => `${k} – ${v}`).join('\n')}`, '1')?.trim();
  if (!theme || !names[theme]) return;
  const name = prompt('Titre de la séquence (ex. « La masse volumique »)');
  if (!name) return;
  let code;
  try {
    code = await nextSequenceCode(level, theme);
  } catch (e) {
    alert((e as Error).message);
    return;
  }
  const order = units.filter((x) => x.kind === 'sequence' && x.level === level && x.theme === theme).length + 1;
  const u: Unit = { id: uid(), kind: 'sequence', subject: SUBJECTS[0], level, theme, name, order, code };
  await db.units.put(u);
  return u;
}

// Bilan d'une classe : fin de programme prévue, ou retard
function ClassBilan({ g, plan }: { g: Group; plan?: ClassPlan }) {
  if (!plan) return null;
  const name = <b>{g.name.replace(/_.*/, '')}</b>;
  if (!plan.hasTimetable)
    return (
      <div className="small muted" title="Aucun cours de cette classe dans l'emploi du temps à venir">
        {name} : pas de cours à venir
      </div>
    );
  if (plan.overflowWeeks)
    return (
      <div className="small" style={{ color: 'var(--forgot)', fontWeight: 700 }}>
        {name} : dépasse de {plan.overflowWeeks} semaine{plan.overflowWeeks > 1 ? 's' : ''}
      </div>
    );
  return <div className="small">{name} : {plan.end ? <>fin prévue le {dm(plan.end)} ✓</> : 'tout est fait ✓'}</div>;
}

const DURATIONS = [0.5, 1, 1.5, 2, 3, 4];
const hLabel = (h: number) => `${String(h).replace('.', ',')} h`;

// Tableau de la séquence : une ligne par séance, une case par classe du niveau
function ClassProgress({
  seq,
  lp,
  tt,
  selected,
  onSelect,
  hideDone,
}: {
  seq: Unit;
  lp: LevelPlan;
  tt: Timetable;
  selected: string;
  onSelect: (id: string) => void;
  hideDone: boolean;
}) {
  const items = lp.items.filter((it) => it.seq.id === seq.id);
  const shown = items.filter((it) => !hideDone || it.unit.id === selected || !finishedByAll(lp, [it]));
  return (
    <div className="panel stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Avancement des classes de {lp.level}</h3>
        <span className="small muted">Gris : date prévue · noir : séance faite (cartes publiées)</span>
      </div>
      {!lp.groups.length && <span className="muted">Aucune classe de {lp.level}.</span>}
      <div style={{ overflowX: 'auto' }}>
        <table className="list">
          <tbody>
            {shown.map((it) => (
              <tr key={it.unit.id} style={{ background: it.unit.id === selected ? '#fff3c4' : undefined }}>
                <td style={{ cursor: 'pointer', minWidth: 180 }} onClick={() => onSelect(it.unit.id)}>
                  <b>{unitLabel(it.unit)}</b>
                </td>
                <td style={{ width: 70 }}>
                  <select
                    value={durationOf(it.unit)}
                    title="Durée prévue"
                    onChange={(e) => db.units.update(it.unit.id, { duration: +e.target.value })}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {hLabel(d)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {lp.groups.map((g) => {
                      const plan = lp.plans.get(g.id);
                      return (
                        <DoneCell
                          key={g.id}
                          g={g}
                          unitId={it.unit.id}
                          done={doneDate(plan, it)}
                          viaSeq={!plan?.done.has(it.unit.id) && plan?.done.has(it.seq.id)}
                          planned={plan?.planned.get(it.unit.id)}
                          tt={tt}
                          groups={lp.groups}
                        />
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length < items.length && <span className="small muted">{items.length - shown.length} séance(s) terminée(s) masquée(s).</span>}
      <span className="small muted">
        Cliquez sur une date pour cocher la séance « faite » lors d'un cours : ses cartes sont publiées pour la classe et ses documents deviennent
        visibles. Les dates prévues se recalculent à chaque fois, d'après l'emploi du temps et le calendrier.
      </span>
    </div>
  );
}

// Vue d'ensemble : une colonne par niveau
function LevelsOverview() {
  const data = usePlans();
  const { session } = useAuth();
  const colors = useLiveQuery(() => levelColors(session!.id), [session], {} as Record<string, string>);
  const [hideDone, setHideDone] = useHideDone();
  const nav = useNavigate();
  if (!data) return null;
  const { units } = data;

  return (
    <div className="page stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>
          Progression
        </h1>
        <HideDoneToggle value={hideDone} onChange={setHideDone} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, alignItems: 'start' }}>
        {data.levels.map((lp) => {
          const seqs = sequencesOf(units, lp.level);
          return (
            <div key={lp.level} className="panel stack" style={{ gap: 8, background: colors[lp.level] }}>
              <div className="spread">
                <h2 style={{ margin: 0 }}>{lp.level}</h2>
                <button
                  className="btn small"
                  onClick={async () => {
                    const u = await createSequence(lp.level, units);
                    if (u) nav(`/prof/progression/${u.id}`);
                  }}
                >
                  + Séquence
                </button>
              </div>
              {lp.groups.map((g) => (
                <ClassBilan key={g.id} g={g} plan={lp.plans.get(g.id)} />
              ))}
              {seqs.map((q, i) => {
                const items = lp.items.filter((it) => it.seq.id === q.id);
                if (hideDone && finishedByAll(lp, items)) return null;
                return (
                  <div key={q.id} className="stack" style={{ gap: 4 }}>
                    {(i === 0 || seqs[i - 1].theme !== q.theme) && (
                      <div className="small" style={{ fontWeight: 900, marginTop: 6, color: 'var(--ink-soft)' }}>
                        {themeLabel(q.theme, q.level)}
                      </div>
                    )}
                    <Link to={`/prof/progression/${q.id}`} className="btn" style={{ display: 'block', textAlign: 'left', whiteSpace: 'normal', background: 'var(--paper)' }}>
                      <div>{unitLabel(q)}</div>
                      <div className="row" style={{ gap: 4, marginTop: 4 }}>
                        {lp.groups.map((g) => {
                          const plan = lp.plans.get(g.id);
                          const n = items.filter((it) => doneDate(plan, it)).length;
                          const next = items.map((it) => plan?.planned.get(it.unit.id)).find(Boolean);
                          const all = items.length > 0 && n === items.length;
                          return (
                            <span
                              key={g.id}
                              className="small"
                              title={all ? 'Terminée' : next ? `Prochaine séance prévue le ${dm(next)}` : undefined}
                              style={{
                                borderRadius: 6,
                                padding: '0 5px',
                                fontWeight: 700,
                                background: all ? '#bfe5c9' : n ? '#fff3c4' : 'transparent', // vert : terminée ; jaune : en cours
                                border: `1px ${n ? 'solid' : 'dashed'} ${all ? 'var(--easy)' : n ? '#00000033' : 'var(--muted-line)'}`,
                                color: n ? 'var(--ink)' : '#9a968d',
                              }}
                            >
                              {g.name.replace(/_.*/, '')} {all ? '✓' : n ? `${n}/${items.length}` : next ? dm(next) : ''}
                            </span>
                          );
                        })}
                      </div>
                    </Link>
                  </div>
                );
              })}
              {!seqs.length && <span className="small muted">Aucune séquence.</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Sequences() {
  const { seqId } = useParams();
  return seqId ? <SequenceScreen seqId={seqId} /> : <LevelsOverview />;
}
