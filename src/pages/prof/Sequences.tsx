import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, SUBJECTS, type Unit } from '../../lib/db';
import { CardBrowser } from '../../components/CardBrowser';
import { CardDetail } from '../../components/CardDetail';
import { CardFace } from '../../components/CardFace';
import { themeColor } from '../../components/widgets';
import { frDate, today } from '../../lib/dates';

function Publish({ unit }: { unit: Unit }) {
  const groups = useLiveQuery(() => db.groups.filter((g) => g.subject === unit.subject && !g.archived).toArray(), [unit.subject], []);
  const pubs = useLiveQuery(
    () => db.publications.where('unitId').anyOf([unit.id, unit.parentId ?? '-']).toArray(),
    [unit.id, unit.parentId],
    [],
  );
  const [dates, setDates] = useState<Record<string, string>>({});

  async function publish(groupId: string) {
    await db.publications.put({ id: uid(), groupId, unitId: unit.id, date: dates[groupId] ?? today() });
  }

  return (
    <div className="panel stack">
      <h3 style={{ margin: 0 }}>Publier pour une classe</h3>
      {!groups.length && <span className="muted">Aucune classe de {unit.subject}. Créez-en une dans l'onglet Classes.</span>}
      <table className="list">
        <tbody>
          {groups.map((g) => {
            const p = pubs.filter((x) => x.groupId === g.id).sort((a, b) => a.date.localeCompare(b.date))[0];
            const viaParent = p && p.unitId !== unit.id;
            return (
              <tr key={g.id}>
                <td style={{ width: 110 }}>
                  <b>{g.name}</b>
                </td>
                <td>
                  {p ? (
                    <span>
                      {p.date > today() ? '🕒 Programmée le ' : '✓ Publiée le '}
                      {frDate(p.date)}
                      {viaParent && <span className="muted small"> (avec la séquence)</span>}
                    </span>
                  ) : (
                    <div className="row" style={{ gap: 8 }}>
                      <input
                        type="date"
                        value={dates[g.id] ?? today()}
                        onChange={(e) => setDates({ ...dates, [g.id]: e.target.value })}
                      />
                      <button className="btn small primary" onClick={() => publish(g.id)}>
                        Publier
                      </button>
                    </div>
                  )}
                </td>
                <td style={{ width: 90, textAlign: 'right' }}>
                  {p && !viaParent && (
                    <button
                      className="btn small ghost"
                      onClick={() => confirm(`Annuler la publication pour ${g.name} ?`) && db.publications.delete(p.id)}
                    >
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <span className="small muted">
        Les cartes publiées entrent dans les révisions des élèves à la date choisie. Une carte déjà vue n'est jamais
        dupliquée, même si elle appartient à plusieurs séquences.
      </span>
    </div>
  );
}

export function Sequences() {
  const units = useLiveQuery(() => db.units.toArray(), [], []);
  const [sel, setSel] = useState<string | null>(null);
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

  const seqs = units.filter((u) => u.kind === 'sequence').sort((a, b) => a.order - b.order);

  async function addSequence() {
    const name = prompt('Nom de la séquence (ex. « Séquence 3 – La masse volumique »)');
    if (!name) return;
    const subject = SUBJECTS[0];
    const u: Unit = { id: uid(), kind: 'sequence', subject, level: '4e', name, order: seqs.length };
    await db.units.put(u);
    setSel(u.id);
  }

  async function addSeance(parent: Unit) {
    const n = units.filter((u) => u.parentId === parent.id).length + 1;
    const name = prompt('Nom de la séance', `Séance ${n}`);
    if (!name) return;
    const u: Unit = { id: uid(), kind: 'seance', parentId: parent.id, subject: parent.subject, level: parent.level, name, order: n };
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
    setSel(null);
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
        <div className="panel stack" style={{ position: 'sticky', top: 80 }}>
          <div className="spread">
            <h2 style={{ margin: 0 }}>Séquences</h2>
            <button className="btn small primary" onClick={addSequence}>
              + Séquence
            </button>
          </div>
          {!seqs.length && <span className="muted small">Créez votre première séquence.</span>}
          {seqs.map((s) => (
            <div key={s.id} className="stack" style={{ gap: 4 }}>
              <button
                className={'btn' + (sel === s.id ? ' primary' : ' ghost')}
                style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
                onClick={() => {
                  setSel(s.id);
                  setPicking(false);
                }}
              >
                {s.name}
              </button>
              {units
                .filter((u) => u.parentId === s.id)
                .sort((a, b) => a.order - b.order)
                .map((se) => (
                  <button
                    key={se.id}
                    className={'btn small' + (sel === se.id ? ' blue' : ' ghost')}
                    style={{ marginLeft: 18, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
                    onClick={() => {
                      setSel(se.id);
                      setPicking(false);
                    }}
                  >
                    {se.name}
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
                    {unit.kind === 'sequence' ? 'SÉQUENCE' : 'SÉANCE · ' + units.find((u) => u.id === unit.parentId)?.name}
                  </div>
                  <h1 className="title" style={{ margin: 0 }}>{unit.name}</h1>
                </div>
                <div className="row">
                  {unit.kind === 'sequence' && (
                    <button className="btn" onClick={() => addSeance(unit)}>
                      + Séance
                    </button>
                  )}
                  <button className="btn ghost" onClick={() => rename(unit)}>
                    Renommer
                  </button>
                  <button className="btn danger" onClick={() => remove(unit)}>
                    Supprimer
                  </button>
                </div>
              </div>

              <Publish unit={unit} />

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
                    <button className="btn primary" onClick={() => setPicking(true)}>
                      + Ajouter des cartes
                    </button>
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
      {open && <CardDetail cardId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
