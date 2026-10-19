// Espace élève : soutien scolaire (travail pour la prochaine fois, dépôt de documents, historique des séances).
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, type Group } from '../../lib/db';
import { tutoringsOf } from '../../lib/tutoring';
import { frDate } from '../../lib/dates';
import { FileList, SessionSummary, UploadButton, placeLabel, whenLabel, dayName } from '../../components/Soutien';
import { RichText } from '../../components/CardFace';
import { Icon } from '../../components/Icon';
import { Link } from 'react-router-dom';
import { unreadTotal } from '../../lib/messages';

export function StudentSoutien() {
  const { session } = useAuth();
  const groups = useLiveQuery(() => tutoringsOf(session!.id), [session]);
  const unread = useLiveQuery(() => unreadTotal(session!.id, 'eleve'), [session], 0);
  if (!groups) return null;
  return (
    <div className="page narrow stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>
          Soutien
        </h1>
        {groups.length > 0 && (
          <Link className="btn" to="/eleve/messages">
            <Icon name="message" /> Poser une question {unread > 0 && <span className="badge">{unread}</span>}
          </Link>
        )}
      </div>
      {!groups.length && <div className="notice">Pas de soutien pour l'instant.</div>}
      {groups.map((g) => (
        <GroupBlock key={g.id} group={g} studentId={session!.id} showName={groups.length > 1} />
      ))}
    </div>
  );
}

function GroupBlock({ group, studentId, showName }: { group: Group; studentId: string; showName: boolean }) {
  const sessions = useLiveQuery(
    async () =>
      (await db.tutoringSessions.where('groupId').equals(group.id).toArray())
        .filter((s) => s.studentIds.includes(studentId))
        .sort((a, b) => b.date.localeCompare(a.date) || (b.start ?? '').localeCompare(a.start ?? '')),
    [group.id, studentId],
  );
  const waiting = useLiveQuery(() => db.tutoringFiles.where('groupId').equals(group.id).filter((f) => !f.sessionId).sortBy('createdAt'), [group.id], []);
  const units = useLiveQuery(() => db.units.toArray(), [], []);
  const last = sessions?.find((s) => s.homework.trim());
  const check = useLiveQuery(async () => (last ? db.homeworkChecks.get(`${last.id}|${studentId}`) : undefined), [last?.id, studentId]);
  if (!sessions) return null;

  async function toggle() {
    if (!last) return;
    await db.homeworkChecks.put({ id: `${last.id}|${studentId}`, sessionId: last.id, groupId: group.id, studentId, done: !check?.done, at: Date.now() });
  }

  return (
    <>
      {showName && <h2 style={{ margin: '8px 0 0' }}>{group.name}</h2>}
      {last && (
        <div className="panel stack" style={{ gap: 10 }}>
          <h3 className="panel-title">
            <Icon name="clipboard" size={16} /> Pour la prochaine fois
          </h3>
          <RichText text={last.homework} />
          <span className="small muted">
            Donné le {dayName(last.date)} {frDate(last.date)}
          </span>
          <button className={'btn big' + (check?.done ? '' : ' primary')} onClick={toggle}>
            <Icon name="check" /> {check?.done ? 'Travail fait (appuie pour annuler)' : "J'ai fait mon travail"}
          </button>
        </div>
      )}

      <div className="panel stack" style={{ gap: 8 }}>
        <div className="spread">
          <h3 className="panel-title">
            <Icon name="file" size={16} /> Pour la prochaine séance
          </h3>
          <UploadButton groupId={group.id} authorId={studentId} byStudent label="Déposer" />
        </div>
        {waiting.length ? (
          <FileList files={waiting} canDelete={(f) => f.authorId === studentId} />
        ) : (
          <span className="small muted">Un exercice qui te bloque, une copie à corriger : prends-le en photo ou dépose le fichier.</span>
        )}
      </div>

      <h2 style={{ margin: '8px 0 0' }}>Mes séances</h2>
      {!sessions.length && <div className="notice">Aucune séance pour l'instant.</div>}
      {sessions.map((s, i) => (
        <details key={s.id} className="panel" open={i === 0}>
          <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
            {whenLabel(s)} <span className="tag plain">{placeLabel(s)}</span>
          </summary>
          <div style={{ marginTop: 10 }}>
            <SessionSummary session={s} studentId={studentId} units={units} />
          </div>
        </details>
      ))}
    </>
  );
}
