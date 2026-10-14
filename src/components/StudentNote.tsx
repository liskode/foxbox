// Note privée du professeur sur un élève (appréciations, points de vigilance…).
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type FamilyContact, type Student, type StudentFlags } from '../lib/db';
import { useAuth } from '../lib/auth';
import { Icon } from './Icon';

export function useNote(studentId: string) {
  const { session } = useAuth();
  const id = `${session!.id}|${studentId}`;
  const note = useLiveQuery(() => db.notes.get(id), [id]);
  const write = async (patch: { text?: string; flags?: StudentFlags; family?: { contacts: FamilyContact[]; notes?: string } }) => {
    const cur = (await db.notes.get(id)) ?? { id, teacherId: session!.id, studentId, text: '', updatedAt: 0 };
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    const empty = !next.text.trim() && !Object.values(next.flags ?? {}).some(Boolean) && !next.family?.contacts.length && !next.family?.notes?.trim();
    if (empty) await db.notes.delete(id);
    else await db.notes.put(next);
  };
  const save = (text: string) => write({ text });
  const setFlag = (k: keyof StudentFlags, v: boolean) => write({ flags: { ...(note?.flags ?? {}), [k]: v } });
  const setFamily = (family: { contacts: FamilyContact[]; notes?: string }) => write({ family });
  return { text: note?.text ?? '', flags: note?.flags ?? {}, family: note?.family, loaded: note !== undefined, updatedAt: note?.updatedAt, save, setFlag, setFamily };
}

export function NoteEditor({ studentId, onDone, autoFocus = false }: { studentId: string; onDone?: () => void; autoFocus?: boolean }) {
  const { text, updatedAt, save } = useNote(studentId);
  const [draft, setDraft] = useState(text);
  useEffect(() => {
    setDraft(text);
  }, [text]);
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
          <Icon name="lock" size={13} /> Visible par vous seul{updatedAt ? ` · modifiée le ${new Date(updatedAt).toLocaleDateString('fr-FR')}` : ''}
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
        <Icon name="edit" size={16} />
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

// ----- Aménagements : cases à cocher (privées) et pastilles -----
export const FLAGS: { key: keyof StudentFlags; label: string; short: string }[] = [
  { key: 'tiersTemps', label: 'Tiers temps', short: '⅓T' },
  { key: 'ulis', label: 'ULIS', short: 'ULIS' },
  { key: 'ordinateur', label: 'Ordinateur en évaluation', short: 'Ordi' },
];

export function FlagChecks({ studentId, compact = false }: { studentId: string; compact?: boolean }) {
  const { flags, setFlag } = useNote(studentId);
  return (
    <span className="row" style={{ gap: compact ? 8 : 14, flexWrap: compact ? 'nowrap' : 'wrap' }}>
      {FLAGS.map((f) => (
        <label key={f.key} className="row small" style={{ gap: 4, fontWeight: 700, whiteSpace: 'nowrap' }} title={f.label}>
          <input type="checkbox" checked={!!flags[f.key]} onChange={(e) => setFlag(f.key, e.target.checked)} />
          {compact ? f.short : f.label}
        </label>
      ))}
    </span>
  );
}

// Aménagements de tous les élèves (pour les listes)
export function useAllFlags() {
  const { session } = useAuth();
  return useLiveQuery(async () => {
    const m = new Map<string, StudentFlags>();
    for (const n of await db.notes.filter((n) => n.teacherId === session!.id).toArray()) if (n.flags) m.set(n.studentId, n.flags);
    return m;
  }, [session?.id], new Map<string, StudentFlags>());
}

export function FlagBadges({ flags }: { flags?: StudentFlags }) {
  const on = FLAGS.filter((f) => flags?.[f.key]);
  if (!on.length) return null;
  return (
    <span className="row" style={{ gap: 3, display: 'inline-flex', flexWrap: 'nowrap' }}>
      {on.map((f) => (
        <span key={f.key} title={f.label} style={{ background: '#e8e1f5', border: '1px solid #00000033', borderRadius: 5, padding: '0 4px', fontSize: '0.68rem', fontWeight: 800 }}>
          {f.short}
        </span>
      ))}
    </span>
  );
}
