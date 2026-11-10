// Flashcards › Introduction : séquence où chaque flashcard de physique-chimie est vue pour la première fois.
// Proposition : la séquence de sa séance si elle est rattachée à une séance, sinon la liste INTRO_PROPOSALS ; le professeur valide.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Card, type Unit } from '../../lib/db';
import { ALL_LEVELS, byProgression, levelColors } from '../../lib/units';
import { INTRO_PROPOSALS } from '../../lib/introProposals';
import { useAuth } from '../../lib/auth';
import { CardFace } from '../../components/CardFace';
import { toast } from '../../components/Toast';
import { confirmBox } from '../../components/Dialog';

const PC = 'Physique-Chimie';
const rank = (l?: string) => (l ? ALL_LEVELS.indexOf(l) : 99);
const LEVEL_OF_CODE: Record<string, string> = { '6': '6e', '5': '5e', '4': '4e', '3': '3e', '2': '2nde', '1': '1re', T: 'Tle' };

type Row = { card: Card; seqId?: string; validated: boolean; source: 'séance' | 'contenu' | '' };
type Filter = 'avalider' | 'sans' | 'validees';

async function load() {
  const cards = (await db.cards.toArray()).filter((c) => !c.deleted && c.subject === PC);
  const units = (await db.units.toArray()).filter((u) => u.subject === PC);
  const byId = new Map(units.map((u) => [u.id, u]));
  const seqs = units
    .filter((u) => u.kind === 'sequence')
    .sort((a, b) => rank(a.level) - rank(b.level) || byProgression(a, b));
  const seqByCode = new Map(seqs.map((s) => [`${s.level}|${s.code}`, s]));
  // Séquences des séances auxquelles chaque flashcard est rattachée (séances 0 de révision exclues)
  const fromLinks = new Map<string, Unit[]>();
  for (const l of await db.unitCards.toArray()) {
    const u = byId.get(l.unitId);
    const seq = u?.kind === 'seance' ? byId.get(u.parentId ?? '') : u;
    if (!seq || seq.kind !== 'sequence' || (u?.code && u.code === `${seq.code}0`)) continue;
    fromLinks.set(l.cardId, [...(fromLinks.get(l.cardId) ?? []), seq]);
  }
  const rows: Row[] = cards.map((card) => {
    if (card.introUnitId && byId.has(card.introUnitId)) return { card, seqId: card.introUnitId, validated: true, source: '' };
    const linked = (fromLinks.get(card.id) ?? []).sort((a, b) => rank(a.level) - rank(b.level) || byProgression(a, b))[0];
    if (linked) return { card, seqId: linked.id, validated: false, source: 'séance' };
    const code = INTRO_PROPOSALS[card.code];
    const s = code && seqByCode.get(`${LEVEL_OF_CODE[code[0]]}|${code}`);
    return s ? { card, seqId: s.id, validated: false, source: 'contenu' } : { card, validated: false, source: '' };
  });
  return { rows, seqs, byId };
}

export function IntroTab() {
  const { session } = useAuth();
  const data = useLiveQuery(load, []);
  const colors = useLiveQuery(() => levelColors(session!.id), [session], {} as Record<string, string>);
  const [filter, setFilter] = useState<Filter>('avalider');
  if (!data) return null;
  const { rows, seqs, byId } = data;

  const toCheck = rows.filter((r) => !r.validated && r.seqId);
  const none = rows.filter((r) => !r.validated && !r.seqId);
  const done = rows.filter((r) => r.validated);
  const shown = filter === 'avalider' ? toCheck : filter === 'sans' ? none : done;

  async function save(list: { card: Card; seqId?: string }[]) {
    const before = list.map(({ card }) => ({ id: card.id, introUnitId: card.introUnitId }));
    const now = Date.now();
    await db.transaction('rw', db.cards, async () => {
      for (const { card, seqId } of list) await db.cards.update(card.id, { introUnitId: seqId, updatedAt: now });
    });
    return before;
  }
  async function validate(list: Row[], label: string) {
    const before = await save(list);
    toast(label, {
      undo: () =>
        db.transaction('rw', db.cards, async () => {
          for (const b of before) await db.cards.update(b.id, { introUnitId: b.introUnitId, updatedAt: Date.now() });
        }),
    });
  }

  // Regroupement par séquence (ordre de la progression), « sans séquence » à la fin
  const groups = new Map<string, Row[]>();
  for (const r of shown) groups.set(r.seqId ?? '', [...(groups.get(r.seqId ?? '') ?? []), r]);
  const order = [...seqs.map((s) => s.id), ''].filter((id) => groups.has(id));

  const select = (r: Row) => (
    <select
      value={r.seqId ?? ''}
      style={{ maxWidth: 260 }}
      onChange={async (e) => {
        const seqId = e.target.value || undefined;
        const before = await save([{ card: r.card, seqId }]);
        toast(seqId ? `${r.card.code} : séquence ${byId.get(seqId)?.code ?? byId.get(seqId)?.name} validée` : `${r.card.code} : séquence retirée`, {
          undo: () => db.cards.update(before[0].id, { introUnitId: before[0].introUnitId, updatedAt: Date.now() }),
        });
      }}
    >
      <option value="">— choisir —</option>
      {seqs.map((s) => (
        <option key={s.id} value={s.id}>
          {s.level} · {s.code} {s.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="stack">
      <div className="panel stack" style={{ gap: 8 }}>
        <h3 className="panel-title">Point d'introduction des flashcards de physique-chimie</h3>
        <span className="small muted">
          Pour chaque flashcard, la séquence où elle est vue pour la première fois. Il sert à remplir les séances 0 de révision (prérequis) et à entourer
          la flashcard de la couleur de son niveau pendant les révisions. Les propositions viennent de la séance à laquelle la flashcard est rattachée,
          sinon de son contenu.
        </span>
        <div className="row" style={{ gap: 8 }}>
          {(
            [
              ['avalider', `À valider (${toCheck.length})`],
              ['sans', `Sans proposition (${none.length})`],
              ['validees', `Validées (${done.length})`],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button key={k} className={'chip cchip' + (filter === k ? '' : ' off')} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
          {filter === 'avalider' && toCheck.length > 0 && (
            <button
              className="btn ghost small"
              onClick={async () =>
                (await confirmBox(`Valider les ${toCheck.length} propositions telles quelles ?`)) && validate(toCheck, `${toCheck.length} flashcard(s) validée(s)`)
              }
            >
              Tout valider
            </button>
          )}
        </div>
      </div>
      {!shown.length && <div className="panel calm small muted">Rien ici.</div>}
      {order.map((id) => {
        const seq = byId.get(id);
        const list = groups.get(id)!;
        return (
          <div key={id || 'none'} className="panel stack" style={{ gap: 8 }}>
            <div className="spread">
              <h3 className="panel-title">
                {seq ? (
                  <>
                    <span className="chip" style={{ background: colors[seq.level ?? ''] ?? 'var(--paper)' }}>
                      {seq.level}
                    </span>
                    {seq.code} {seq.name}
                  </>
                ) : (
                  'Sans séquence'
                )}
                <span className="small muted">({list.length})</span>
              </h3>
              {seq && filter === 'avalider' && (
                <button className="btn primary small" onClick={() => validate(list, `${list.length} flashcard(s) validée(s) en ${seq.code ?? seq.name}`)}>
                  Valider ces {list.length}
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {list.map((r) => (
                <div key={r.card.id} className="stack" style={{ gap: 4, border: '1px solid var(--muted-line)', borderRadius: 8, padding: 8 }}>
                  <div className="spread small">
                    <b>{r.card.code}</b>
                    {r.source && <span className={'tag ' + (r.source === 'séance' ? 'ok' : 'warn')}>{r.source === 'séance' ? 'd’après sa séance' : 'd’après son contenu'}</span>}
                  </div>
                  <div style={{ maxHeight: 110, overflow: 'hidden', fontSize: '0.85rem' }}>
                    <CardFace html={r.card.front} />
                  </div>
                  {select(r)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
