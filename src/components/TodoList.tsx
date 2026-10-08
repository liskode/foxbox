// To-do list personnelle : tâches générales ou liées à une classe, avec échéance facultative.
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type Todo } from '../lib/db';
import { useAuth } from '../lib/auth';
import { addDays, frDate, today } from '../lib/dates';

export function TodoList({ groupId }: { groupId?: string }) {
  const { session } = useAuth();
  const groups = useLiveQuery(() => db.groups.filter((g) => !g.archived).toArray(), [], []);
  const todos = useLiveQuery(
    async () => (await db.todos.toArray()).filter((t) => t.teacherId === session!.id && (!groupId || t.groupId === groupId)),
    [groupId, session],
    [],
  );
  const [text, setText] = useState('');
  const [gid, setGid] = useState(groupId ?? '');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await db.todos.put({
      id: uid(),
      teacherId: session!.id,
      text: text.trim(),
      groupId: (groupId ?? gid) || undefined,
      due: due || undefined,
      done: false,
      createdAt: Date.now(),
    });
    setText('');
    setDue('');
  }

  const d = today();
  const week = addDays(d, 7);
  const open = todos.filter((t) => !t.done);
  const sections: [string, Todo[]][] = [
    ['En retard', open.filter((t) => t.due && t.due < d)],
    ["Aujourd'hui", open.filter((t) => t.due === d)],
    ['Cette semaine', open.filter((t) => t.due && t.due > d && t.due <= week)],
    ['Plus tard', open.filter((t) => t.due && t.due > week)],
    ['Sans échéance', open.filter((t) => !t.due)],
  ];
  const done = todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  return (
    <div className="panel stack">
      <div className="spread">
        <h2 style={{ margin: 0 }}>À faire</h2>
        <span className="small muted">🔒 visible par vous seul</span>
      </div>
      <form className="row" onSubmit={add}>
        <input style={{ flex: 1, minWidth: 200 }} placeholder="Nouvelle tâche…" value={text} onChange={(e) => setText(e.target.value)} />
        {!groupId && (
          <select value={gid} onChange={(e) => setGid(e.target.value)}>
            <option value="">Général</option>
            {groups
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        )}
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} title="Échéance (facultative)" />
        <button className="btn primary small" type="submit">
          Ajouter
        </button>
      </form>
      {!open.length && <span className="muted small">Rien à faire 🎉</span>}
      {sections.map(
        ([title, list]) =>
          list.length > 0 && (
            <div key={title} className="stack" style={{ gap: 4 }}>
              <b className="small" style={{ color: title === 'En retard' ? 'var(--forgot)' : 'var(--ink-soft)' }}>
                {title}
              </b>
              {list
                .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || a.createdAt - b.createdAt)
                .map((t) => (
                  <TodoRow key={t.id} t={t} showGroup={!groupId} />
                ))}
            </div>
          ),
      )}
      {done.length > 0 && (
        <div>
          <a href="#" className="small muted" onClick={(e) => (e.preventDefault(), setShowDone(!showDone))}>
            {showDone ? 'Masquer' : 'Afficher'} les tâches faites ({done.length})
          </a>
          {showDone && (
            <div className="stack" style={{ gap: 4, marginTop: 6 }}>
              {done.slice(0, 30).map((t) => (
                <TodoRow key={t.id} t={t} showGroup={!groupId} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TodoRow({ t, showGroup }: { t: Todo; showGroup: boolean }) {
  const g = useLiveQuery(() => (t.groupId ? db.groups.get(t.groupId) : undefined), [t.groupId]);
  return (
    <div className="row" style={{ gap: 8, flexWrap: 'nowrap', opacity: t.done ? 0.55 : 1 }}>
      <input
        type="checkbox"
        checked={t.done}
        onChange={(e) => db.todos.update(t.id, { done: e.target.checked, doneAt: e.target.checked ? Date.now() : undefined })}
        style={{ width: 18, height: 18 }}
      />
      <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
      {showGroup && g && (
        <span className="chip" style={{ background: g.color ?? 'var(--paper)' }}>
          {g.name}
        </span>
      )}
      {t.due && <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{frDate(t.due)}</span>}
      <button className="btn small ghost" title="Supprimer" onClick={() => db.todos.delete(t.id)}>
        ✕
      </button>
    </div>
  );
}
