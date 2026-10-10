// Progression d'une classe : séquences et séances de son niveau, cochées quand elles sont faites
// (date du cours), avec la date prévisionnelle des suivantes. Cocher publie les cartes pour la classe.
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Group, type Unit } from '../lib/db';
import { useAuth } from '../lib/auth';
import { unitLabel, themeLabel, levelOfName } from '../lib/units';
import { levelPlans, doneDate, dm } from '../lib/forecast';
import { DoneCell } from './DoneCell';

// Niveau déduit du nom de la classe (« 4A_2627 » → 4e)
export const levelOf = (g: Group) => levelOfName(g.name);

// Séquences suivies par la classe : toutes celles de son niveau, dans l'ordre de la Bibliothèque
export function useClassSequences(group: Group) {
  return useLiveQuery(async () => {
    const lvl = levelOf(group);
    return (await db.units.toArray())
      .filter((u) => u.kind === 'sequence' && (!lvl || u.level === lvl))
      .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', 'fr', { numeric: true }) || a.order - b.order);
  }, [group.id, group.name]);
}

export function useProgress(group: Group) {
  return useLiveQuery(async () => {
    const pubs = await db.publications.where('groupId').equals(group.id).toArray();
    const done = new Map<string, string>(); // unitId -> date de réalisation
    for (const p of pubs) if (!done.has(p.unitId) || p.date < done.get(p.unitId)!) done.set(p.unitId, p.date);
    return done;
  }, [group.id]);
}

export function Progression({ group }: { group: Group }) {
  const { session } = useAuth();
  const data = useLiveQuery(() => levelPlans(session!.id), [session?.id]);
  if (!data) return null;
  const lp = data.levels.find((l) => l.level === levelOf(group));
  const plan = lp?.plans.get(group.id);
  if (!lp || !plan)
    return <div className="notice">Le niveau de cette classe n'est pas reconnu : son nom doit commencer par le niveau (ex. « 4A_2627 »).</div>;

  const seqs: Unit[] = [...new Map(lp.items.map((it) => [it.seq.id, it.seq])).values()];
  return (
    <div className="stack">
      <div className="spread">
        <span className="small muted">
          Cliquez sur une date pour cocher la séance « faite » : ses cartes sont <b>publiées</b> pour les élèves. Gris : date prévue.
        </span>
        <Link to={seqs[0] ? `/prof/progression/${seqs[0].id}` : '/prof/progression'} className="btn small ghost">
          Préparer les séquences
        </Link>
      </div>
      <div className="small">
        {plan.overflowWeeks ? (
          <b style={{ color: 'var(--forgot)' }}>Au rythme prévu, le programme dépasse de {plan.overflowWeeks} semaine(s).</b>
        ) : plan.end ? (
          <b>Fin du programme prévue le {dm(plan.end)} ✓</b>
        ) : null}
      </div>
      {!seqs.length && (
        <div className="notice">
          Aucune séquence de {lp.level}. Créez-les dans <Link to="/prof/progression">Progression</Link>.
        </div>
      )}
      {seqs.map((seq, i) => {
        const items = lp.items.filter((it) => it.seq.id === seq.id);
        const n = items.filter((it) => doneDate(plan, it)).length;
        return (
          <div key={seq.id} className="stack" style={{ gap: 8 }}>
            {(i === 0 || seqs[i - 1].theme !== seq.theme) && <h3 style={{ margin: i ? '10px 0 0' : 0 }}>{themeLabel(seq.theme, seq.level)}</h3>}
            <div
              className="panel stack"
              style={{ gap: 6, borderLeft: `8px solid ${n === items.length ? 'var(--easy)' : n ? 'var(--orange)' : 'var(--muted-line)'}` }}
            >
              <div className="spread">
                <Link to={`/prof/progression/${seq.id}`} style={{ fontWeight: 900, fontSize: '1.05rem', color: 'inherit' }}>
                  {unitLabel(seq)}
                </Link>
                <b className="small">
                  {n}/{items.length}
                </b>
              </div>
              {items.map((it) => (
                <div key={it.unit.id} className="row" style={{ gap: 10, paddingLeft: 12, flexWrap: 'nowrap' }}>
                  <span style={{ flex: 1, fontWeight: doneDate(plan, it) ? 700 : 500 }} title={it.unit.description || undefined}>
                    {it.unit.isEval && '📝 '}
                    {it.unit.id === seq.id ? '(séquence entière)' : unitLabel(it.unit)}
                    {it.unit.documents?.length ? <span className="small muted"> · 📄{it.unit.documents.length}</span> : null}
                  </span>
                  <DoneCell
                    g={group}
                    unitId={it.unit.id}
                    done={doneDate(plan, it)}
                    viaSeq={!plan.done.has(it.unit.id) && plan.done.has(it.seq.id)}
                    planned={plan.planned.get(it.unit.id)}
                    tt={data.tt}
                    groups={lp.groups}
                    showName={false}
                    isEval={it.unit.isEval}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
