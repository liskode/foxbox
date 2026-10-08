// Note privée du professeur sur un élève (appréciations, points de vigilance…).
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Student } from '../lib/db';
import { useAuth } from '../lib/auth';

export function useNote(studentId: string) {
  const { session } = useAuth();
  const id = `${session!.id}|${studentId}`;
  const note = useLiveQuery(() => db.notes.get(id), [id]);
  const save = async (text: string) => {
    if (!text.trim()) await db.notes.delete(id);
    else await db.notes.put({ id, teacherId: session!.id, studentId, text, updatedAt: Date.now() });
  };
  return { text: note?.text ?? '', updatedAt: note?.updatedAt, save };
}

export function NoteEditor({ studentId, onDone, autoFocus = false }: { studentId: string; onDone?: () => void; autoFocus?: boolean }) {
  const { text, updatedAt, save } = useNote(studentId);
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Appréciations, points de vigilance, aménagements… (visible par vous seul)"
        style={{ minHeight: 140, fontFamily: 'var(--font)', fontSize: '0.95rem' }}
        autoFocus={autoFocus}
      />
      <div className="spread">
        <span className="small muted">
          🔒 Visible par vous seul{updatedAt ? ` · modifiée le ${new Date(updatedAt).toLocaleDateString('fr-FR')}` : ''}
        </span>
        <div className="row">
          {onDone && (
            <button className="btn ghost small" onClick={onDone}>
              Annuler
            </button>
          )}
          <button
            className="btn primary small"
            disabled={draft === text}
            onClick={async () => {
              await save(draft);
              onDone?.();
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// Pictogramme pour la liste des élèves : coloré si une note existe, ouvre l'éditeur au clic
export function NoteButton({ student }: { student: Student }) {
  const { text } = useNote(student.id);
  const [open, setOpen] = useState(false);
  const has = !!text.trim();
  return (
    <>
      <button
        className="btn small"
        title={has ? text.slice(0, 300) : 'Ajouter une note'}
        onClick={() => setOpen(true)}
        style={{
          background: has ? 'var(--matiere)' : 'var(--paper)',
          borderColor: has ? 'var(--line)' : 'var(--muted-line)',
          boxShadow: has ? undefined : 'none',
          opacity: has ? 1 : 0.55,
        }}
      >
        📝
      </button>
      {open && (
        <>
          <div className="drawer-bg" onClick={() => setOpen(false)} />
          <div
            className="panel stack"
            style={{ position: 'fixed', top: '15vh', left: '50%', transform: 'translateX(-50%)', width: 'min(560px, 92vw)', zIndex: 32 }}
          >
            <h3 style={{ margin: 0 }}>
              Note — {student.firstName} {student.lastName}
            </h3>
            <NoteEditor studentId={student.id} onDone={() => setOpen(false)} autoFocus />
          </div>
        </>
      )}
    </>
  );
}
