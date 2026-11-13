// Descriptif d'une séquence ou d'une séance, et ses documents (PDF) téléchargeables par les élèves.
import { alertBox, confirmBox } from './Dialog';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, fileBlob, type Unit } from '../lib/db';
import { mediaUrl } from './CardFace';
import { Icon } from './Icon';
import { nextDocCode } from '../lib/units';

const MAX_MB = 50;
export const sizeLabel = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} ko`);

export async function openDocument(mediaId: string, name: string) {
  const url = await mediaUrl(mediaId);
  if (!url) return alertBox('Document introuvable (vérifiez la connexion).');
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.target = '_blank';
  a.click();
}

// Un même PDF peut servir à plusieurs évaluations (modèle, évaluation créée depuis un modèle, copie) ou séances :
// on ne supprime le fichier que lorsque plus aucune ne le cite.
export async function deleteDocumentIfUnused(mediaId: string) {
  const cites = (x: { documents?: { mediaId: string }[] }) => !!x.documents?.some((d) => d.mediaId === mediaId);
  if ((await db.evaluations.filter(cites).count()) || (await db.units.filter(cites).count())) return;
  await db.media.delete(mediaId);
}

export function DocumentList({ docs }: { docs: NonNullable<Unit['documents']> }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {docs.map((d) => (
        <button key={d.mediaId} className="btn small" onClick={() => openDocument(d.mediaId, d.name)} title={sizeLabel(d.size)}>
          <Icon name="file" size={15} /> {d.name}
        </button>
      ))}
    </div>
  );
}

export function UnitDetails({ unit }: { unit: Unit }) {
  const [desc, setDesc] = useState(unit.description ?? '');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    setDesc(unit.description ?? '');
  }, [unit.id, unit.description]);
  const docs = unit.documents ?? [];
  // Code à donner à un nouveau document de cours de ce niveau (repris dans le nom du PDF et de sa source)
  const freeCode = useLiveQuery(
    async () => (unit.kind === 'seance' && unit.level ? nextDocCode(await db.units.where('subject').equals(unit.subject).toArray(), unit.subject, unit.level) : undefined),
    [unit.kind, unit.subject, unit.level],
  );

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = [];
    for (const f of [...files]) {
      if (f.size > MAX_MB * 1048576) {
        alertBox(`« ${f.name} » dépasse ${MAX_MB} Mo.`);
        continue;
      }
      setBusy(`Ajout de ${f.name}…`);
      const mediaId = `doc-${crypto.randomUUID()}`;
      await db.media.put({ id: mediaId, name: f.name, blob: await fileBlob(f) });
      added.push({ mediaId, name: f.name, size: f.size });
    }
    await db.units.update(unit.id, { documents: [...docs, ...added] });
    setBusy('');
  }

  async function remove(mediaId: string, name: string) {
    if (!(await confirmBox(`Retirer le document « ${name} » ?`))) return;
    await db.units.update(unit.id, { documents: docs.filter((d) => d.mediaId !== mediaId) });
    await deleteDocumentIfUnused(mediaId);
  }

  return (
    <div className="panel stack">
      <h3 style={{ margin: 0 }}>Descriptif {unit.kind === 'seance' ? 'de la séance' : 'de la séquence'}</h3>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => desc !== (unit.description ?? '') && db.units.update(unit.id, { description: desc })}
        placeholder="Objectifs, déroulé, matériel, activités du manuel…"
        style={{ fontFamily: 'var(--font)', fontSize: '0.95rem', minHeight: 90 }}
      />
      <div className="spread">
        <b className="small">Documents ({docs.length})</b>
        <label className="btn small">
          + Ajouter un PDF
          <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </label>
      </div>
      {busy && <span className="small">{busy}</span>}
      {docs.map((d) => (
        <div key={d.mediaId} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <button className="btn small ghost" onClick={() => openDocument(d.mediaId, d.name)}>
            <Icon name="file" size={15} /> {d.name}
          </button>
          <span className="small muted">{sizeLabel(d.size)}</span>
          <button className="btn small ghost" onClick={() => remove(d.mediaId, d.name)} title="Retirer">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <span className="small muted">
        Les documents sont téléchargeables par les élèves, dans leur espace, dès que la séance est cochée « faite » pour leur classe.
        Le descriptif reste pour vous.
      </span>
      {freeCode && (
        <span className="small muted">
          Nouvelle fiche : code libre <b>{freeCode}</b> (ajoutez -C pour un cours, -E pour des exercices corrigés), à écrire au début du nom du PDF
          et dans sa source. Ce code ne change pas si la séance est déplacée.
        </span>
      )}
    </div>
  );
}

// Liste de documents PDF modifiable (ajout, ouverture, retrait)
export function DocumentsEditor({ docs, onChange, label = 'Documents' }: { docs: NonNullable<Unit['documents']>; onChange: (d: NonNullable<Unit['documents']>) => Promise<unknown>; label?: string }) {
  const [busy, setBusy] = useState('');
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = [];
    for (const f of [...files]) {
      if (f.size > MAX_MB * 1048576) {
        alertBox(`« ${f.name} » dépasse ${MAX_MB} Mo.`);
        continue;
      }
      setBusy(`Ajout de ${f.name}…`);
      const mediaId = `doc-${crypto.randomUUID()}`;
      await db.media.put({ id: mediaId, name: f.name, blob: await fileBlob(f) });
      added.push({ mediaId, name: f.name, size: f.size });
    }
    await onChange([...docs, ...added]);
    setBusy('');
  }
  async function remove(mediaId: string, name: string) {
    if (!(await confirmBox(`Retirer le document « ${name} » ?`))) return;
    await onChange(docs.filter((d) => d.mediaId !== mediaId));
    await deleteDocumentIfUnused(mediaId);
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="spread">
        <b className="small">
          {label} ({docs.length})
        </b>
        <label className="btn small">
          + Ajouter un PDF
          <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </label>
      </div>
      {busy && <span className="small">{busy}</span>}
      {docs.map((d) => (
        <div key={d.mediaId} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <button className="btn small ghost" onClick={() => openDocument(d.mediaId, d.name)}>
            <Icon name="file" size={15} /> {d.name}
          </button>
          <span className="small muted">{sizeLabel(d.size)}</span>
          <button className="btn small ghost" onClick={() => remove(d.mediaId, d.name)} title="Retirer">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
