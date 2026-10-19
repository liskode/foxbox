// Soutien scolaire : éléments communs à l'espace professeur et à l'espace élève (documents, liens, résumé d'une séance).
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TutoringFile, type TutoringSession, type Unit } from '../lib/db';
import { addFiles, durationLabel } from '../lib/tutoring';
import { frDate } from '../lib/dates';
import { unitLabel } from '../lib/units';
import { openDocument, sizeLabel } from './UnitDetails';
import { RichText } from './CardFace';
import { toast } from './Toast';
import { Icon } from './Icon';

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const dayName = (iso: string) => DAYS[new Date(iso + 'T12:00').getDay()];

export function FileList({ files, canDelete }: { files: TutoringFile[]; canDelete?: (f: TutoringFile) => boolean }) {
  if (!files.length) return null;
  async function remove(f: TutoringFile) {
    await db.tutoringFiles.delete(f.id);
    toast(`Document « ${f.name} » retiré`, { undo: () => db.tutoringFiles.put(f) });
  }
  return (
    <div className="row" style={{ gap: 8 }}>
      {files.map((f) => (
        <span key={f.id} className="row" style={{ gap: 0, flexWrap: 'nowrap', maxWidth: '100%' }}>
          <button
            className="btn small"
            style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
            onClick={() => openDocument(f.mediaId, f.name)}
            title={`${sizeLabel(f.size)}${f.byStudent ? ' · déposé par l’élève' : ''}`}
          >
            <Icon name={f.type.startsWith('image/') ? 'camera' : 'file'} size={15} /> {f.name}
          </button>
          {canDelete?.(f) && (
            <button className="btn small ghost" style={{ border: 'none' }} title="Retirer" onClick={() => remove(f)}>
              <Icon name="x" size={14} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

// Dépôt de documents (sur téléphone : photo prise sur le moment, photothèque ou fichier)
export function UploadButton({
  groupId,
  sessionId,
  authorId,
  byStudent,
  label = 'Ajouter un document',
  primary = false,
}: {
  groupId: string;
  sessionId?: string;
  authorId: string;
  byStudent: boolean;
  label?: string;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={'btn small' + (primary ? ' primary' : '')} style={busy ? { opacity: 0.6 } : undefined}>
      <Icon name="plus" size={15} /> {busy ? 'Envoi…' : label}
      <input
        type="file"
        multiple
        hidden
        onChange={async (e) => {
          const list = e.target.files;
          if (!list?.length) return;
          setBusy(true);
          const n = await addFiles(groupId, sessionId, list, authorId, byStudent);
          setBusy(false);
          e.target.value = '';
          if (n) toast(n > 1 ? `${n} documents ajoutés` : 'Document ajouté');
        }}
      />
    </label>
  );
}

export function LinkList({ links }: { links: TutoringSession['links'] }) {
  if (!links.length) return null;
  return (
    <div className="stack" style={{ gap: 4 }}>
      {links.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noreferrer" className="row small" style={{ gap: 6, flexWrap: 'nowrap', overflowWrap: 'anywhere' }}>
          <Icon name="link" size={15} /> {l.label || l.url}
        </a>
      ))}
    </div>
  );
}

// Une séance est « à venir » jusqu'à sa fin (heure de début + durée ; sans heure : jusqu'au soir)
export function sessionEnd(s: TutoringSession) {
  const [h, m] = (s.start ?? '23:59').split(':').map(Number);
  return new Date(`${s.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime() + (s.start ? s.duration * 60000 : 0);
}
export const isUpcoming = (s: TutoringSession) => sessionEnd(s) > Date.now();

export const placeLabel = (s: TutoringSession) => (s.place === 'en ligne' ? 'En ligne' : 'À domicile');
export const whenLabel = (s: TutoringSession) =>
  `${dayName(s.date)} ${frDate(s.date)}${s.start ? ` à ${s.start.replace(':', ' h ')}` : ''} · ${durationLabel(s.duration)}`;

// Résumé d'une séance pour l'élève : contenu de la séance, sa note, le travail, documents, liens
export function SessionSummary({ session, studentId, units }: { session: TutoringSession; studentId: string; units: Unit[] }) {
  const note = useLiveQuery(() => db.sessionNotes.get(`${session.id}|${studentId}|eleve`), [session.id, studentId]);
  const files = useLiveQuery(() => db.tutoringFiles.where('sessionId').equals(session.id).sortBy('createdAt'), [session.id], []);
  const points = session.unitIds.map((id) => units.find((u) => u.id === id)).filter(Boolean) as Unit[];
  return (
    <div className="stack" style={{ gap: 10 }}>
      {points.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          {points.map((u) => (
            <span key={u.id} className="tag plain" style={{ whiteSpace: 'normal' }}>
              {unitLabel(u)}
            </span>
          ))}
        </div>
      )}
      {session.done.trim() && <RichText text={session.done} />}
      {note?.text.trim() && (
        <div className="panel note stack" style={{ gap: 4, padding: '10px 14px' }}>
          <b className="small">Pour toi</b>
          <RichText text={note.text} />
        </div>
      )}
      {session.homework.trim() && (
        <div className="stack" style={{ gap: 4 }}>
          <b className="small">Travail donné</b>
          <RichText text={session.homework} />
        </div>
      )}
      <FileList files={files} canDelete={(f) => f.byStudent && f.authorId === studentId} />
      <LinkList links={session.links} />
      {session.cardIds.length > 0 && (
        <span className="small muted">
          <Icon name="cards" size={14} /> {session.cardIds.length} flashcard(s) ajoutée(s) à tes révisions
        </span>
      )}
    </div>
  );
}
