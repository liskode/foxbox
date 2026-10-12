// Notes libres du professeur sur une classe (privées), enregistrées en quittant le champ.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Group } from '../lib/db';
import { useAuth } from '../lib/auth';

export function ClassNotes({ group }: { group: Group }) {
  const { session } = useAuth();
  const id = `${session!.id}|${group.id}`;
  const note = useLiveQuery(() => db.classNotes.get(id), [id]);
  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(note?.text ?? ''), [note?.text]);

  async function save() {
    if (draft === (note?.text ?? '')) return;
    if (!draft.trim()) await db.classNotes.delete(id);
    else await db.classNotes.put({ id, teacherId: session!.id, groupId: group.id, text: draft, updatedAt: Date.now() });
  }

  return (
    <div className="panel stack" style={{ gap: 6 }}>
      <h3 style={{ margin: 0 }}>📝 Notes sur la classe</h3>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        placeholder="Remarques, ambiance, points à travailler, informations du conseil de classe…"
        style={{ minHeight: 110, fontFamily: 'var(--font)', fontSize: '0.95rem' }}
      />
      <span className="small muted">
        🔒 Visible par vous seul · enregistré en quittant le champ
        {note?.updatedAt ? ` · modifié le ${new Date(note.updatedAt).toLocaleDateString('fr-FR')}` : ''}
      </span>
    </div>
  );
}
