import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { studentSubjects, todaySession } from '../../lib/leitner';
import { Ring } from '../../components/widgets';
import { Avatar } from '../../components/Avatar';

export function StudentHome() {
  const { session } = useAuth();
  const nav = useNavigate();
  const student = useLiveQuery(() => db.students.get(session!.id), [session]);
  const subjects = useLiveQuery(async () => {
    const subs = await studentSubjects(session!.id);
    return Promise.all(subs.map(async (s) => ({ subject: s, ...(await todaySession(session!.id, s)) })));
  }, [session, student?.goals]);

  if (!student || !subjects) return null;

  async function setGoal(subject: string, goal: number) {
    await db.students.update(student!.id, { goals: { ...student!.goals, [subject]: Math.max(1, Math.min(100, goal)) } });
  }

  return (
    <div className="page narrow stack">
      <div className="row" style={{ gap: 14 }}>
        <Avatar student={student} size={70} />
        <h1 className="title" style={{ margin: 0 }}>Salut {student.firstName} !</h1>
      </div>
      {!subjects.length && <div className="notice">Tu n'es inscrit(e) dans aucune classe pour l'instant.</div>}
      {subjects.map((s) => {
        const reached = s.done >= s.goal;
        return (
          <div key={s.subject} className="panel stack">
            <div className="spread">
              <h2 style={{ margin: 0 }}>{s.subject}</h2>
              <span className="muted small">{s.pending} carte(s) à revoir</span>
            </div>
            <div className="row" style={{ gap: 20 }}>
              <Ring value={s.done} max={s.goal} label="aujourd'hui" />
              <div className="stack" style={{ flex: 1, gap: 10 }}>
                {s.queue.length ? (
                  <button className="btn primary big" onClick={() => nav(`/eleve/revision/${encodeURIComponent(s.subject)}`)}>
                    {s.done ? 'Continuer' : 'Commencer'} ({s.queue.length})
                  </button>
                ) : reached ? (
                  <>
                    <b>🎉 Objectif atteint ! Reviens demain.</b>
                    {s.pending > 0 && (
                      <button className="btn ghost" onClick={() => nav(`/eleve/revision/${encodeURIComponent(s.subject)}?extra=10`)}>
                        Encore 10 cartes
                      </button>
                    )}
                  </>
                ) : (
                  <b>✓ Rien à revoir aujourd'hui.</b>
                )}
                <div className="row small" style={{ gap: 8 }}>
                  Mon objectif :
                  <button className="btn small ghost" onClick={() => setGoal(s.subject, s.goal - 5)}>
                    −
                  </button>
                  <b>{s.goal} cartes / jour</b>
                  <button className="btn small ghost" onClick={() => setGoal(s.subject, s.goal + 5)}>
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
