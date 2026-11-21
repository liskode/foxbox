import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { mixedPath, studentSubjects, todaySession } from '../../lib/leitner';
import { Ring } from '../../components/widgets';
import { Avatar } from '../../components/Avatar';
import { StudentReport } from '../../components/StudentReport';
import { Icon } from '../../components/Icon';

// Accueil élève : une seule révision du jour, mélangeant toutes les matières (cases à décocher pour n'en faire qu'une partie)
export function StudentHome() {
  const { session } = useAuth();
  const nav = useNavigate();
  const student = useLiveQuery(() => db.students.get(session!.id), [session]);
  const subjects = useLiveQuery(async () => {
    const subs = await studentSubjects(session!.id);
    return Promise.all(subs.map(async (s) => ({ subject: s, ...(await todaySession(session!.id, s)) })));
  }, [session, student?.goals]);
  const [off, setOff] = useState<string[]>([]); // matières décochées (toutes cochées à chaque visite)

  if (!student || !subjects) return null;

  async function setGoal(subject: string, goal: number) {
    await db.students.update(student!.id, { goals: { ...student!.goals, [subject]: Math.max(1, Math.min(100, goal)) } });
  }

  const chosen = subjects.filter((s) => !off.includes(s.subject));
  const all = chosen.length === subjects.length;
  const names = all ? undefined : chosen.map((s) => s.subject);
  const left = chosen.reduce((a, s) => a + s.queue.length, 0);
  const done = chosen.reduce((a, s) => a + s.done, 0);
  const goal = chosen.reduce((a, s) => a + s.goal, 0);
  const pending = chosen.reduce((a, s) => a + s.pending, 0);
  const several = subjects.length > 1;

  return (
    <div className="page narrow stack">
      <div className="row" style={{ gap: 14 }}>
        <Avatar student={student} size={70} />
        <h1 className="title" style={{ margin: 0 }}>Salut {student.firstName} !</h1>
      </div>
      {!subjects.length && <div className="notice">Tu n'es inscrit(e) dans aucune classe pour l'instant.</div>}
      {subjects.length > 0 && (
        <div className="panel stack">
          <div className="spread">
            <h2 style={{ margin: 0 }}>{several ? 'Mes flashcards du jour' : subjects[0].subject}</h2>
            <span className="muted small">{pending} flashcard(s) à revoir</span>
          </div>
          <div className="row" style={{ gap: 20 }}>
            <Ring value={done} max={goal || 1} label="aujourd'hui" />
            <div className="stack" style={{ flex: 1, gap: 10 }}>
              {!chosen.length ? (
                <span className="muted">Coche au moins une matière.</span>
              ) : left ? (
                <button className="btn primary big" onClick={() => nav(mixedPath(names))}>
                  {done ? 'Continuer' : 'Commencer'} ({left})
                </button>
              ) : done >= goal ? (
                <>
                  <span className="tag ok" style={{ fontSize: '0.95rem', padding: '6px 10px' }}>
                    <Icon name="check" size={16} /> Objectif atteint ! Reviens demain.
                  </span>
                  {pending > 0 && (
                    <button className="btn ghost" onClick={() => nav(mixedPath(names, 10))}>
                      Encore 10 flashcards
                    </button>
                  )}
                </>
              ) : (
                <b><Icon name="check" size={14} /> Rien à revoir aujourd'hui.</b>
              )}
              {several && <span className="small muted">Toutes tes matières mélangées : c'est le principe des boîtes, tout revoir un peu chaque jour.</span>}
            </div>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            {subjects.map((s) => (
              <div key={s.subject} className="row small" style={{ gap: 8, borderTop: '1px solid var(--soft-line)', paddingTop: 8 }}>
                {several ? (
                  <label className="row" style={{ gap: 8, flex: 1, minWidth: 140, fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={!off.includes(s.subject)}
                      onChange={(e) => setOff(e.target.checked ? off.filter((x) => x !== s.subject) : [...off, s.subject])}
                    />
                    {s.subject}
                    <span className="muted" style={{ fontWeight: 600 }}>
                      {s.done}/{s.goal}
                    </span>
                  </label>
                ) : (
                  <span style={{ flex: 1 }}>Mon objectif :</span>
                )}
                <button className="btn small ghost" onClick={() => setGoal(s.subject, s.goal - 5)} title="Objectif : 5 de moins">
                  −
                </button>
                <b>{s.goal} / jour</b>
                <button className="btn small ghost" onClick={() => setGoal(s.subject, s.goal + 5)} title="Objectif : 5 de plus">
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <h2 style={{ margin: '10px 0 0' }}>Mes progrès</h2>
      <StudentReport studentId={student.id} />
    </div>
  );
}
