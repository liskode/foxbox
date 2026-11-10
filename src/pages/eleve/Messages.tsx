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
    // Soutien en groupe (plusieurs élèves) : fil commun, en plus de la conversation privée avec le professeur
    const shared = groups.filter((g) => Object.keys(g.memberNames ?? {}).length > 1);
    return {
      student: await db.students.get(session!.id),
      teachers: await Promise.all(teacherIds.map(async (id) => ({ id, name: (await db.teachers.get(id))?.name }))),
      shared,
    };
  }, [session]);
  if (!data?.student) return null;
  const st = data.student;
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>
        Messages
      </h1>
      {!data.teachers.length && <div className="notice">Pas de soutien pour l'instant.</div>}
      {data.shared.map((g) => (
        <Chat
          key={g.id}
          teacherId={g.teacherIds[0]}
          studentId={g.id}
          me={{ id: st.id, name: st.firstName }}
          role="eleve"
          group={{ names: Object.entries(g.memberNames ?? {}).filter(([id]) => id !== st.id).map(([, n]) => n) }}
          title={`Fil du groupe · ${g.name}`}
          hint="Fil commun : ton professeur et tous les élèves du groupe lisent ces messages. Pour une question personnelle, écris plutôt dans ta conversation privée ci-dessous."
        />
      ))}
      {data.teachers.map((t) => (
        <Chat
          key={t.id}
          teacherId={t.id}
          studentId={st.id}
          me={{ id: st.id, name: st.firstName }}
          role="eleve"
          title={data.teachers.length > 1 ? `Avec ${t.name ?? 'ton professeur'}` : data.shared.length ? 'Conversation privée avec ton professeur' : undefined}
          hint="Une question, un exercice qui bloque ? Écris, joins une photo ou enregistre un mémo vocal. Seuls les destinataires cochés lisent ton message."
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
