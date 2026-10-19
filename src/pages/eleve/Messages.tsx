// Espace élève : questions au professeur de soutien (fil de discussion), avec photo, document ou mémo vocal.
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { tutoringsOf } from '../../lib/tutoring';
import { Chat } from '../../components/Chat';

export function StudentMessages() {
  const { session } = useAuth();
  const data = useLiveQuery(async () => {
    const groups = await tutoringsOf(session!.id);
    const teacherIds = [...new Set(groups.map((g) => g.teacherIds[0]))];
    return { student: await db.students.get(session!.id), teachers: await Promise.all(teacherIds.map(async (id) => ({ id, name: (await db.teachers.get(id))?.name }))) };
  }, [session]);
  if (!data?.student) return null;
  const st = data.student;
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>
        Messages
      </h1>
      {!data.teachers.length && <div className="notice">Pas de soutien pour l'instant.</div>}
      {data.teachers.map((t) => (
        <Chat
          key={t.id}
          teacherId={t.id}
          studentId={st.id}
          thread="eleve"
          me={{ id: st.id, name: st.firstName }}
          title={data.teachers.length > 1 ? `Avec ${t.name ?? 'ton professeur'}` : undefined}
          hint="Une question, un exercice qui bloque ? Écris, joins une photo ou enregistre un mémo vocal. Tes parents ne lisent pas ces messages."
        />
      ))}
      <label className="field small">
        Être prévenu(e) par e-mail des réponses (facultatif)
        <input
          type="email"
          placeholder="ton adresse e-mail"
          defaultValue={st.notifyEmail ?? ''}
          onBlur={(e) => db.students.update(st.id, { notifyEmail: e.target.value.trim() || undefined })}
        />
      </label>
    </div>
  );
}
