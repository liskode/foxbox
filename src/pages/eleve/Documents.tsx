// Espace élève : documents des séances faites dans ses classes.
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, type Unit } from '../../lib/db';
import { today } from '../../lib/dates';
import { unitLabel } from '../../lib/units';
import { DocumentList } from '../../components/UnitDetails';

export function StudentDocuments() {
  const { session } = useAuth();
  const blocks = useLiveQuery(async () => {
    const ms = await db.memberships.where('studentId').equals(session!.id).toArray();
    const pubs = (await db.publications.where('groupId').anyOf(ms.map((m) => m.groupId)).toArray()).filter((p) => p.date <= today());
    const all = await db.units.toArray();
    const visible = new Set<string>();
    for (const p of pubs) {
      visible.add(p.unitId);
      all.filter((u) => u.parentId === p.unitId).forEach((u) => visible.add(u.id)); // séquence publiée en entier
    }
    const seqs = new Map<string, { seq: Unit; items: Unit[] }>();
    for (const u of all) {
      if (!visible.has(u.id) || !u.documents?.length) continue;
      const seq = u.kind === 'sequence' ? u : all.find((x) => x.id === u.parentId);
      if (!seq) continue;
      if (!seqs.has(seq.id)) seqs.set(seq.id, { seq, items: [] });
      seqs.get(seq.id)!.items.push(u);
    }
    return [...seqs.values()]
      .sort((a, b) => (a.seq.code ?? '').localeCompare(b.seq.code ?? '', 'fr', { numeric: true }) || a.seq.order - b.seq.order)
      .map((b) => ({ ...b, items: b.items.sort((x, y) => (x.kind === 'sequence' ? -1 : y.kind === 'sequence' ? 1 : x.order - y.order)) }));
  }, [session]);

  return (
    <div className="page stack">
      <h1 className="title">Mes documents</h1>
      {blocks && !blocks.length && <div className="notice">Pas encore de document : ils apparaissent ici au fil des séances.</div>}
      {blocks?.map(({ seq, items }) => (
        <div key={seq.id} className="panel stack">
          <h2 style={{ margin: 0 }}>{unitLabel(seq)}</h2>
          {items.map((u) => (
            <div key={u.id} className="stack" style={{ gap: 4 }}>
              {u.kind === 'seance' && <b className="small">{unitLabel(u)}</b>}
              <DocumentList docs={u.documents!} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
