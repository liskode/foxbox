// Progression d'une classe : séquences et séances cochées quand elles sont faites.
// Cocher une séance publie automatiquement ses cartes pour la classe ; décocher retire la publication.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type Group, type Unit } from '../lib/db';
import { frDate, today } from '../lib/dates';
import { unitLabel } from '../lib/units';

// Niveau déduit du nom de la classe (« 4A_2627 » → 4e)
export const levelOf = (g: Group) => {
  const m = g.name.match(/^\s*(\d)/);
  return m ? `${m[1]}e` : undefined;
};

export function useClassSequences(group: Group) {
  return useLiveQuery(async () => {
    const all = (await db.units.toArray()).filter((u) => u.kind === 'sequence');
    if (group.sequenceIds) return group.sequenceIds.map((id) => all.find((u) => u.id === id)).filter(Boolean) as Unit[];
    const lvl = levelOf(group);
    return all
      .filter((u) => u.subject === group.subject && (!lvl || !u.level || u.level === lvl))
      .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', 'fr', { numeric: true }) || a.order - b.order);
  }, [group.id, group.sequenceIds?.join(), group.subject, group.name]);
}

export function useProgress(group: Group) {
  return useLiveQuery(async () => {
    const pubs = await db.publications.where('groupId').equals(group.id).toArray();
    const done = new Map<string, string>(); // unitId -> date de réalisation
    for (const p of pubs) if (p.date <= today() && (!done.has(p.unitId) || p.date < done.get(p.unitId)!)) done.set(p.unitId, p.date);
    return done;
  }, [group.id]);
}

async function markDone(group: Group, unit: Unit) {
  await db.publications.put({ id: uid(), groupId: group.id, unitId: unit.id, date: today() });
}

async function unmark(group: Group, unit: Unit) {
  const pubs = await db.publications.where('groupId').equals(group.id).filter((p) => p.unitId === unit.id).toArray();
  await db.publications.bulkDelete(pubs.map((p) => p.id));
}

function CardCount({ unitIds }: { unitIds: string[] }) {
  const n = useLiveQuery(async () => new Set((await db.unitCards.where('unitId').anyOf(unitIds).toArray()).map((l) => l.cardId)).size, [unitIds.join()]);
  return n ? <span className="small muted">🃏 {n}</span> : null;
}

function SequenceBlock({ group, seq, done }: { group: Group; seq: Unit; done: Map<string, string> }) {
  const seances = useLiveQuery(async () => (await db.units.where('parentId').equals(seq.id).toArray()).sort((a, b) => a.order - b.order), [seq.id], []);
  const wholeSeq = done.get(seq.id);
  const nDone = seances.filter((s) => wholeSeq || done.has(s.id)).length;
  const complete = seances.length ? nDone === seances.length : !!wholeSeq;

  async function toggle(u: Unit, on: boolean) {
    if (on) await markDone(group, u);
    else if (confirm(`Décocher « ${u.name} » ? Ses cartes ne seront plus proposées aux élèves de ${group.name} (leur progression est conservée).`))
      await unmark(group, u);
  }

  return (
    <div className="panel stack" style={{ gap: 6, borderLeft: `8px solid ${complete ? 'var(--easy)' : nDone ? 'var(--orange)' : 'var(--muted-line)'}` }}>
      <div className="spread">
        <label className="row" style={{ gap: 10, fontWeight: 900, fontSize: '1.05rem' }}>
          {!seances.length && <input type="checkbox" checked={!!wholeSeq} onChange={(e) => toggle(seq, e.target.checked)} style={{ width: 20, height: 20 }} />}
          {unitLabel(seq)}
          {seq.documents?.length ? <span className="small muted">📄{seq.documents.length}</span> : null}
        </label>
        <span className="row small" style={{ gap: 10 }}>
          <CardCount unitIds={[seq.id, ...seances.map((s) => s.id)]} />
          {seances.length > 0 && (
            <b>
              {nDone}/{seances.length} séance(s)
            </b>
          )}
          {wholeSeq && <span className="muted">faite le {frDate(wholeSeq)}</span>}
        </span>
      </div>
      {seances.map((s) => {
        const d = done.get(s.id);
        const viaSeq = !d && !!wholeSeq;
        return (
          <label key={s.id} className="row" style={{ gap: 10, paddingLeft: 12, flexWrap: 'nowrap' }}>
            <input type="checkbox" checked={!!d || viaSeq} disabled={viaSeq} onChange={(e) => toggle(s, e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ flex: 1, fontWeight: d || viaSeq ? 700 : 500 }} title={s.description || undefined}>
              {unitLabel(s)}
              {s.documents?.length ? <span className="small muted"> · 📄{s.documents.length}</span> : null}
            </span>
            <CardCount unitIds={[s.id]} />
            <span className="small muted" style={{ whiteSpace: 'nowrap', minWidth: 110, textAlign: 'right' }}>
              {d ? `faite le ${frDate(d)}` : viaSeq ? 'avec la séquence' : ''}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function Progression({ group }: { group: Group }) {
  const seqs = useClassSequences(group);
  const done = useProgress(group);
  const all = useLiveQuery(async () => (await db.units.toArray()).filter((u) => u.kind === 'sequence').sort((a, b) => a.order - b.order), [], []);
  const [manage, setManage] = useState(false);
  if (!seqs || !done) return null;
  const ids = seqs.map((s) => s.id);

  async function setList(next: string[]) {
    await db.groups.update(group.id, { sequenceIds: next });
  }

  return (
    <div className="stack">
      <div className="spread">
        <span className="small muted">
          Cochez une séance quand elle est faite : ses cartes sont <b>publiées automatiquement</b> pour les élèves de la classe.
        </span>
        <div className="row">
          <Link to="/prof/sequences" className="btn small ghost">
            Préparer les séquences (Bibliothèque)
          </Link>
          <button className="btn small" onClick={() => setManage(!manage)}>
            {manage ? 'Fermer' : 'Choisir les séquences'}
          </button>
        </div>
      </div>
      {manage && (
        <div className="panel stack">
          <b>Séquences suivies par {group.name}</b>
          {all.map((u) => {
            const i = ids.indexOf(u.id);
            return (
              <div key={u.id} className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={i >= 0} onChange={(e) => setList(e.target.checked ? [...ids, u.id] : ids.filter((x) => x !== u.id))} />
                <span style={{ flex: 1 }}>
                  {unitLabel(u)} {u.level && <span className="small muted">({u.level})</span>}
                </span>
                {i >= 0 && (
                  <>
                    <button className="btn small ghost" disabled={i === 0} onClick={() => setList(ids.map((x, j) => (j === i - 1 ? u.id : j === i ? ids[i - 1] : x)))}>
                      ↑
                    </button>
                    <button className="btn small ghost" disabled={i === ids.length - 1} onClick={() => setList(ids.map((x, j) => (j === i + 1 ? u.id : j === i ? ids[i + 1] : x)))}>
                      ↓
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {!all.length && <span className="muted small">Aucune séquence dans la Bibliothèque pour l'instant.</span>}
        </div>
      )}
      {!seqs.length && !manage && (
        <div className="notice">
          Aucune séquence pour cette classe. Créez vos séquences et séances dans <Link to="/prof/sequences">Bibliothèque › Séquences</Link>, puis
          choisissez celles que suit la classe.
        </div>
      )}
      {seqs.map((s) => (
        <SequenceBlock key={s.id} group={group} seq={s} done={done} />
      ))}
    </div>
  );
}

// Résumé pour les tableaux de bord : dernière séance faite, prochaine à faire
export function useProgressSummary(group: Group) {
  const seqs = useClassSequences(group);
  const done = useProgress(group);
  return useLiveQuery(async () => {
    if (!seqs || !done) return null;
    let last: { name: string; date: string } | null = null;
    let next: string | null = null;
    let total = 0;
    let n = 0;
    for (const seq of seqs) {
      const seances = (await db.units.where('parentId').equals(seq.id).toArray()).sort((a, b) => a.order - b.order);
      const items = seances.length ? seances : [seq];
      for (const u of items) {
        total++;
        const d = done.get(u.id) ?? done.get(seq.id);
        if (d) {
          n++;
          if (!last || d >= last.date) last = { name: unitLabel(u), date: d };
        } else if (!next) next = seances.length ? `${unitLabel(u)} (${seq.name})` : unitLabel(u);
      }
    }
    return { last, next, total, done: n };
  }, [seqs, done]);
}
