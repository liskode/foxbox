import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { renameStudent, deleteStudent } from '../../lib/students';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Rule } from '../../lib/db';
import { StudentReport } from '../../components/StudentReport';
import { DEFAULT_GOAL } from '../../lib/leitner';
import { Avatar } from '../../components/Avatar';
import { removePhoto } from '../../lib/photos';
import { NoteEditor } from '../../components/StudentNote';

export function StudentPage() {
  const { id } = useParams();
  const student = useLiveQuery(async () => (await db.students.get(id!)) ?? null, [id]);
  const groups = useLiveQuery(async () => {
    const ms = await db.memberships.where('studentId').equals(id!).toArray();
    return (await db.groups.bulkGet(ms.map((m) => m.groupId))).filter(Boolean).map((g) => g!);
  }, [id], []);
  const [edit, setEdit] = useState<{ first: string; last: string } | null>(null);
  const [msg, setMsg] = useState('');
  const nav = useNavigate();
  const [params] = useSearchParams();
  const classe = params.get('classe');
  // Élèves de la classe d'où l'on vient, dans l'ordre de la liste (nom, prénom)
  const order = useLiveQuery(async () => {
    if (!classe) return [];
    const ms = await db.memberships.where('groupId').equals(classe).toArray();
    const list = (await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean).map((x) => x!);
    return list.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)).map((x) => x.id);
  }, [classe], [] as string[]);
  const pos = order.indexOf(id!);
  const go = (delta: number) => {
    const next = order[pos + delta];
    // replace : le bouton Retour ramène directement à la liste, sans repasser par chaque élève
    if (next) nav(`/prof/eleves/${next}?classe=${classe}`, { replace: true });
  };
  useEffect(() => {
    // Changement d'élève : on ferme l'édition en cours
    setEdit(null);
    setMsg('');
  }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (edit || /INPUT|SELECT|TEXTAREA/.test(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (student === undefined) return null;
  if (!student) return <div className="page muted">Élève introuvable.</div>;
  const subjects = [...new Set(groups.map((g) => g.subject))];

  return (
    <div className="page stack">
      <div className="spread">
        <div className="row" style={{ gap: 16 }}>
          <div className="stack" style={{ gap: 4, alignItems: 'center' }}>
            <Avatar student={student} size={96} editable />
            {student.photoId && (
              <a href="#" className="small muted" onClick={(e) => (e.preventDefault(), removePhoto(student.id))}>
                retirer
              </a>
            )}
          </div>
          <div>
          <div className="row small" style={{ gap: 10 }}>
            <a href="#" className="muted" onClick={(e) => (e.preventDefault(), history.back())}>
              ← Retour
            </a>
            {pos >= 0 && order.length > 1 && (
              <span className="row" style={{ gap: 6 }}>
                <button className="btn small ghost" disabled={pos === 0} onClick={() => go(-1)} title="Élève précédent (flèche gauche)">
                  ◀
                </button>
                <span className="muted">
                  {pos + 1} / {order.length}
                </span>
                <button className="btn small ghost" disabled={pos === order.length - 1} onClick={() => go(1)} title="Élève suivant (flèche droite)">
                  ▶
                </button>
                <span className="muted">(flèches ← → du clavier)</span>
              </span>
            )}
          </div>
          {edit ? (
            <form
              className="row"
              style={{ margin: '6px 0' }}
              onSubmit={async (e) => {
                e.preventDefault();
                setMsg('Enregistrement…');
                try {
                  const login = await renameStudent(student.id, edit.first, edit.last);
                  setMsg(login !== student.login ? `Nouvel identifiant de connexion : ${login}` : '');
                  setEdit(null);
                } catch (err) {
                  setMsg('Erreur : ' + (err as Error).message);
                }
              }}
            >
              <input placeholder="Prénom" value={edit.first} onChange={(e) => setEdit({ ...edit, first: e.target.value })} autoFocus />
              <input placeholder="Nom" value={edit.last} onChange={(e) => setEdit({ ...edit, last: e.target.value })} required />
              <button className="btn primary small" type="submit">Enregistrer</button>
              <button className="btn ghost small" type="button" onClick={() => setEdit(null)}>Annuler</button>
            </form>
          ) : (
            <h1 className="title" style={{ margin: 0 }}>
              {student.firstName || <span style={{ color: 'var(--forgot)' }}>(prénom ?)</span>} {student.lastName}{' '}
              <button
                className="btn small ghost"
                style={{ fontFamily: 'var(--font)', verticalAlign: 'middle' }}
                onClick={() => setEdit({ first: student.firstName, last: student.lastName })}
              >
                ✎ Corriger le nom
              </button>
            </h1>
          )}
          {msg && <div className="notice small">{msg}</div>}
          <div className="muted">
            {groups.map((g) => `${g.name} (${g.subject})`).join(' · ')} · identifiant <span className="code">{student.login}</span>
          </div>
          </div>
        </div>
        <div className="panel row" style={{ padding: '10px 14px' }}>
          {subjects.map((s) => (
            <label key={s} className="field">
              Objectif / jour{subjects.length > 1 ? ` (${s})` : ''}
              <input
                type="number"
                min={1}
                style={{ width: 80 }}
                value={student.goals[s] ?? DEFAULT_GOAL}
                onChange={(e) => db.students.update(student.id, { goals: { ...student.goals, [s]: Math.max(1, Number(e.target.value)) } })}
              />
            </label>
          ))}
          <label className="field">
            Règle d'erreur
            <select value={student.rule} onChange={(e) => db.students.update(student.id, { rule: e.target.value as Rule })}>
              <option value="strict">Stricte (retour boîte 1)</option>
              <option value="douce">Douce (−1 boîte)</option>
            </select>
          </label>
        </div>
      </div>
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>📝 Note</h3>
        <NoteEditor key={student.id} studentId={student.id} />
      </div>
      <StudentReport studentId={student.id} teacherView />
      <div>
        <button
          className="btn danger"
          onClick={async () => {
            if (
              !confirm(
                `Supprimer définitivement ${student.firstName} ${student.lastName} ?\n\nSon compte, sa photo, sa progression et son historique seront effacés, dans toutes ses classes. Cette action est irréversible.`,
              )
            )
              return;
            try {
              await deleteStudent(student.id);
              nav(-1);
            } catch (e) {
              alert((e as Error).message);
            }
          }}
        >
          Supprimer l'élève
        </button>
      </div>
    </div>
  );
}
