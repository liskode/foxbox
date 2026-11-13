// Espace élève : questions à ses professeurs (classes et soutien), avec photo, document ou mémo vocal.
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, type Group } from '../../lib/db';
import { tutoringsOf } from '../../lib/tutoring';
import { Chat } from '../../components/Chat';

export function StudentMessages() {
  const { session } = useAuth();
  const data = useLiveQuery(async () => {
    const groups = await tutoringsOf(session!.id);
    // Tous ses professeurs (classes et soutien), avec les matières de chacun
    const ms = await db.memberships.where('studentId').equals(session!.id).toArray();
    const all = ((await db.groups.bulkGet(ms.map((m) => m.groupId))).filter((g) => g && !g.archived) as Group[]).sort((a, b) => a.name.localeCompare(b.name));
    const teacherIds = [...new Set(all.map((g) => g.teacherIds[0]))];
    const subjects = (t: string) => [...new Set(all.filter((g) => g.teacherIds[0] === t).map((g) => g.subject))].join(', ');
    // Soutien en groupe (plusieurs élèves) : fil commun, en plus de la conversation privée avec le professeur
    const shared = groups.filter((g) => Object.keys(g.memberNames ?? {}).length > 1);
    return {
      student: await db.students.get(session!.id),
      teachers: await Promise.all(teacherIds.map(async (id) => ({ id, name: (await db.teachers.get(id))?.name, subjects: subjects(id) }))),
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
      {!data.teachers.length && <div className="notice">Pas encore de classe ni de soutien.</div>}
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
          title={data.teachers.length > 1 ? `Avec ${t.name ?? `ton professeur de ${t.subjects}`}` : data.shared.length ? 'Conversation privée avec ton professeur' : undefined}
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
