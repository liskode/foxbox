// Espace élève : soutien scolaire (travail pour la prochaine fois, dépôt de documents, historique des séances).
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, type Group } from '../../lib/db';
import { tutoringsOf } from '../../lib/tutoring';
import { frDate } from '../../lib/dates';
import { FileList, SessionSummary, UploadButton, isUpcoming, placeLabel, whenLabel, dayName } from '../../components/Soutien';
import { durationLabel } from '../../lib/tutoring';
import { RichText } from '../../components/CardFace';
import { Icon } from '../../components/Icon';
import { Link, useNavigate } from 'react-router-dom';
import { studentSubjects, todaySession } from '../../lib/leitner';
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
      {groups.length > 0 && <DailyCards studentId={session!.id} />}
      {!groups.length && <div className="notice">Pas de soutien pour l'instant.</div>}
      {groups.map((g) => (
        <GroupBlock key={g.id} group={g} studentId={session!.id} showName={groups.length > 1} />
      ))}
    </div>
  );
}

// Révision quotidienne des flashcards, rappelée en tête de la page Soutien
function DailyCards({ studentId }: { studentId: string }) {
  const nav = useNavigate();
  const today = useLiveQuery(async () => {
    const subs = await studentSubjects(studentId);
    const all = await Promise.all(subs.map(async (subject) => ({ subject, ...(await todaySession(studentId, subject)) })));
    return { left: all.reduce((a, x) => a + x.queue.length, 0), done: all.reduce((a, x) => a + x.done, 0), first: all.find((x) => x.queue.length) };
  }, [studentId]);
  if (!today) return null;
  return (
    <button
      className="btn primary big stack"
      style={{ gap: 4, width: '100%', alignItems: 'flex-start', textAlign: 'left', whiteSpace: 'normal' }}
      onClick={() => nav(today.first ? `/eleve/revision/${encodeURIComponent(today.first.subject)}` : '/eleve')}
    >
      <span className="row" style={{ gap: 8 }}>
        <Icon name="cards" /> Je révise mes flashcards CHAQUE JOUR
      </span>
      <span className="small" style={{ fontWeight: 700 }}>
        {today.left
          ? `${today.left} flashcard(s) à revoir aujourd'hui${today.done ? ` · ${today.done} déjà faite(s)` : ''}`
          : today.done
            ? `Fait pour aujourd'hui (${today.done}) : bravo ! Reviens demain.`
            : "Rien à revoir aujourd'hui : reviens demain."}
      </span>
    </button>
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
  // Séances à venir (la plus proche d'abord) et séances passées (la plus récente d'abord)
  const upcoming = (sessions ?? []).filter(isUpcoming).reverse();
  const past = (sessions ?? []).filter((s) => !isUpcoming(s));
  const next = upcoming[0];
  const last = past[0];
  const note = useLiveQuery(async () => (last ? db.sessionNotes.get(`${last.id}|${studentId}|eleve`) : undefined), [last?.id, studentId]);
  const check = useLiveQuery(async () => (last ? db.homeworkChecks.get(`${last.id}|${studentId}`) : undefined), [last?.id, studentId]);
  if (!sessions) return null;

  async function toggle() {
    if (!last) return;
    await db.homeworkChecks.put({ id: `${last.id}|${studentId}`, sessionId: last.id, groupId: group.id, studentId, done: !check?.done, at: Date.now() });
  }

  return (
    <>
      {showName && <h2 style={{ margin: '8px 0 0' }}>{group.name}</h2>}
      {next ? (
        <div className="panel stack next-session" style={{ gap: 10 }}>
          <h3 className="panel-title">
            <Icon name="calendar" size={16} /> Prochaine séance
          </h3>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, lineHeight: 1.25 }}>
            {dayName(next.date)} {frDate(next.date)}
            {next.start ? ` à ${next.start.replace(':', ' h ')}` : ''}
          </div>
          <span className="row small" style={{ gap: 6 }}>
            {durationLabel(next.duration)} <span className="tag plain">{placeLabel(next)}</span>
          </span>
          <SessionSummary session={next} studentId={studentId} units={units} />
        </div>
      ) : (
        <div className="panel calm small muted">Pas encore de prochaine séance prévue.</div>
      )}

      {last && (last.homework.trim() || note?.text.trim()) && (
        <div className="panel stack" style={{ gap: 10 }}>
          <h3 className="panel-title">
            <Icon name="clipboard" size={16} /> Consignes de la dernière séance
          </h3>
          <span className="small muted">
            Séance du {dayName(last.date)} {frDate(last.date)}
          </span>
          {note?.text.trim() && (
            <div className="panel note stack" style={{ gap: 4, padding: '10px 14px' }}>
              <b className="small">Pour toi</b>
              <RichText text={note.text} />
            </div>
          )}
          {last.homework.trim() && (
            <>
              <b className="small">Travail à faire</b>
              <RichText text={last.homework} />
              <button className={'btn big' + (check?.done ? '' : ' primary')} onClick={toggle}>
                <Icon name="check" /> {check?.done ? 'Travail fait (appuie pour annuler)' : "J'ai fait mon travail"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="panel stack" style={{ gap: 8 }}>
        <div className="spread">
          <h3 className="panel-title">
            <Icon name="file" size={16} /> Documents pour la prochaine séance
          </h3>
          <UploadButton groupId={group.id} authorId={studentId} byStudent label="Déposer" />
        </div>
        {waiting.length ? (
          <FileList files={waiting} canDelete={(f) => f.authorId === studentId} />
        ) : (
          <span className="small muted">Un exercice qui te bloque, une copie à corriger : prends-le en photo ou dépose le fichier.</span>
        )}
      </div>

      {upcoming.length > 1 && (
        <>
          <h2 style={{ margin: '8px 0 0' }}>Séances suivantes</h2>
          {upcoming.slice(1).map((s) => (
            <details key={s.id} className="panel">
              <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
                {whenLabel(s)} <span className="tag plain">{placeLabel(s)}</span>
              </summary>
              <div style={{ marginTop: 10 }}>
                <SessionSummary session={s} studentId={studentId} units={units} />
              </div>
            </details>
          ))}
        </>
      )}

      <h2 style={{ margin: '8px 0 0' }}>Séances passées</h2>
      {!past.length && <div className="notice">Aucune séance pour l'instant.</div>}
      {past.map((s) => (
        <details key={s.id} className="panel">
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
