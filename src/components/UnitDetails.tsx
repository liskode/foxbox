// Descriptif d'une séquence ou d'une séance, et ses documents (PDF) téléchargeables par les élèves.
import { useEffect, useState } from 'react';
import { db, type Unit } from '../lib/db';
import { mediaUrl } from './CardFace';

const MAX_MB = 50;
export const sizeLabel = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} ko`);

export async function openDocument(mediaId: string, name: string) {
  const url = await mediaUrl(mediaId);
  if (!url) return alert('Document introuvable (vérifiez la connexion).');
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.target = '_blank';
  a.click();
}

export function DocumentList({ docs }: { docs: NonNullable<Unit['documents']> }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {docs.map((d) => (
        <button key={d.mediaId} className="btn small" onClick={() => openDocument(d.mediaId, d.name)} title={sizeLabel(d.size)}>
          📄 {d.name}
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

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = [];
    for (const f of [...files]) {
      if (f.size > MAX_MB * 1048576) {
        alert(`« ${f.name} » dépasse ${MAX_MB} Mo.`);
        continue;
      }
      setBusy(`Ajout de ${f.name}…`);
      const mediaId = `doc-${crypto.randomUUID()}`;
      await db.media.put({ id: mediaId, name: f.name, blob: f });
      added.push({ mediaId, name: f.name, size: f.size });
    }
    await db.units.update(unit.id, { documents: [...docs, ...added] });
    setBusy('');
  }

  async function remove(mediaId: string, name: string) {
    if (!confirm(`Retirer le document « ${name} » ?`)) return;
    await db.units.update(unit.id, { documents: docs.filter((d) => d.mediaId !== mediaId) });
    await db.media.delete(mediaId);
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
            📄 {d.name}
          </button>
          <span className="small muted">{sizeLabel(d.size)}</span>
          <button className="btn small ghost" onClick={() => remove(d.mediaId, d.name)} title="Retirer">
            ✕
          </button>
        </div>
      ))}
      <span className="small muted">
        Les documents sont téléchargeables par les élèves, dans leur espace, dès que la séance est cochée « faite » pour leur classe.
        Le descriptif reste pour vous.
      </span>
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
        alert(`« ${f.name} » dépasse ${MAX_MB} Mo.`);
        continue;
      }
      setBusy(`Ajout de ${f.name}…`);
      const mediaId = `doc-${crypto.randomUUID()}`;
      await db.media.put({ id: mediaId, name: f.name, blob: f });
      added.push({ mediaId, name: f.name, size: f.size });
    }
    await onChange([...docs, ...added]);
    setBusy('');
  }
  async function remove(mediaId: string, name: string) {
    if (!confirm(`Retirer le document « ${name} » ?`)) return;
    await onChange(docs.filter((d) => d.mediaId !== mediaId));
    await db.media.delete(mediaId);
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
            📄 {d.name}
          </button>
          <span className="small muted">{sizeLabel(d.size)}</span>
          <button className="btn small ghost" onClick={() => remove(d.mediaId, d.name)} title="Retirer">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
