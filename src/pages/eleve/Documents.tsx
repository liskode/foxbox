// Espace élève : documents des séances faites dans ses classes, et documents et liens des séances de soutien.
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, type Unit } from '../../lib/db';
import { today } from '../../lib/dates';
import { unitLabel } from '../../lib/units';
import { DocumentList } from '../../components/UnitDetails';
import { FileList, LinkList, whenLabel, isUpcoming } from '../../components/Soutien';
import { isTutoring, type TutoringFile, type TutoringSession } from '../../lib/db';
import { Icon } from '../../components/Icon';

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
      .sort((a, b) => a.seq.order - b.seq.order || (a.seq.code ?? '').localeCompare(b.seq.code ?? '', 'fr', { numeric: true }))
      .map((b) => ({ ...b, items: b.items.sort((x, y) => (x.kind === 'sequence' ? -1 : y.kind === 'sequence' ? 1 : x.order - y.order)) }));
  }, [session]);
  // Soutien : chaque séance (la plus récente d'abord) avec ses documents et ses liens
  const tutoring = useLiveQuery(async () => {
    const ms = await db.memberships.where('studentId').equals(session!.id).toArray();
    const groups = (await db.groups.bulkGet(ms.map((m) => m.groupId))).filter((g) => isTutoring(g) && !g!.archived);
    const out: { s: TutoringSession; files: TutoringFile[] }[] = [];
    for (const g of groups) {
      const ss = (await db.tutoringSessions.where('groupId').equals(g!.id).toArray()).filter((x) => x.studentIds.includes(session!.id));
      for (const x of ss) {
        const files = await db.tutoringFiles.where('sessionId').equals(x.id).sortBy('createdAt');
        if (files.length || x.links.length) out.push({ s: x, files });
      }
    }
    return out.sort((a, b) => b.s.date.localeCompare(a.s.date) || (b.s.start ?? '').localeCompare(a.s.start ?? ''));
  }, [session]);

  return (
    <div className="page stack">
      <h1 className="title">Mes documents</h1>
      {blocks && tutoring && !blocks.length && !tutoring.length && (
        <div className="notice">Pas encore de document : ils apparaissent ici au fil des séances.</div>
      )}
      {!!tutoring?.length && (
        <div className="panel stack">
          <h2 className="panel-title" style={{ fontSize: '1.15rem' }}>
            <Icon name="file" /> Séances de soutien
          </h2>
          {tutoring.map(({ s, files }) => (
            <div key={s.id} className="stack" style={{ gap: 6, paddingTop: 10, borderTop: '1px solid var(--soft-line)' }}>
              <b className="small">
                {whenLabel(s)}
                {isUpcoming(s) && <span className="tag warn" style={{ marginLeft: 6 }}>à venir</span>}
              </b>
              {s.done.trim() && <span className="small muted">{s.done.trim().split('\n')[0].replace(/[*#]/g, '').slice(0, 120)}</span>}
              <FileList files={files} />
              <LinkList links={s.links} />
            </div>
          ))}
        </div>
      )}
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
