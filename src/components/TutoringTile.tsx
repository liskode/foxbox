// Accueil Soutien : tableau de bord d'un suivi (messages non lus, documents déposés non vus, prochaine séance,
// solde des règlements, régularité et boîtes des flashcards). Un clic ouvre le suivi ; chaque indicateur ouvre son onglet.
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Group, type Student } from '../lib/db';
import { durationLabel, isUpcoming, trackLabel } from '../lib/tutoring';
import { unreadIn } from '../lib/messages';
import { loadLedger, money } from '../lib/billing';
import { studentSubjects } from '../lib/leitner';
import { boxDistribution, heatmapCounts } from '../lib/stats';
import { addDays, today } from '../lib/dates';
import { Boxes, Heatmap } from './widgets';
import { Icon } from './Icon';
import { hLabel } from './Soutien';

// Documents déposés par l'élève : vus quand le professeur ouvre les séances du suivi
export const filesSeenId = (teacherId: string, groupId: string) => `${teacherId}|files|${groupId}`;
export async function markFilesSeen(teacherId: string, groupId: string) {
  const id = filesSeenId(teacherId, groupId);
  await db.messageReads.put({ id, userId: teacherId, at: Date.now() });
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
// « Mar 27/10 · 13 h »
export const shortWhen = (date: string, start?: string) =>
  `${DAYS[new Date(date + 'T12:00').getDay()]} ${date.slice(8, 10)}/${date.slice(5, 7)}${start ? ` · ${hLabel(start)}` : ''}`;

function Badge({ n }: { n: number }) {
  return n > 0 ? (
    <span className="badge" style={{ position: 'absolute', top: -7, right: -9 }}>
      {n}
    </span>
  ) : null;
}

export function TutoringTile({ group, teacherId }: { group: Group; teacherId: string }) {
  const nav = useNavigate();
  const d = useLiveQuery(async () => {
    const ms = await db.memberships.where('groupId').equals(group.id).toArray();
    const students = ((await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[]).sort((a, b) => a.firstName.localeCompare(b.firstName));
    const sessions = await db.tutoringSessions.where('groupId').equals(group.id).toArray();
    const seen = (await db.messageReads.get(filesSeenId(teacherId, group.id)))?.at ?? 0;
    const files = await db.tutoringFiles.where('groupId').equals(group.id).filter((f) => f.byStudent && f.createdAt > seen).count();
    let unread = 0;
    for (const s of students) unread += await unreadIn(teacherId, teacherId, s.id);
    const next = sessions.filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))[0];
    const done = sessions.filter((s) => !isUpcoming(s));
    const since = addDays(today(), -7 * 12);
    const per = await Promise.all(
      students.map(async (s) => {
        const { ledger } = await loadLedger(teacherId, s.id);
        const reviews = (await db.reviews.where('studentId').equals(s.id).toArray()).filter((r) => r.date >= since);
        const dist = [0, 0, 0, 0, 0, 0, 0, 0];
        for (const subj of await studentSubjects(s.id)) (await boxDistribution(s.id, subj)).forEach((n, i) => (dist[i] += n));
        return { s, ledger, counts: heatmapCounts(reviews), dist };
      }),
    );
    // Échéances : séances à venir et évaluations annoncées ; évaluations ajoutées ou modifiées depuis la dernière visite
    const t = today();
    const evals = (await db.assessments.where('studentId').anyOf(students.map((s) => s.id)).toArray()).filter((a) => a.date >= t);
    let newEvals = 0;
    for (const s of students) {
      const seenE = (await db.messageReads.get(`${teacherId}|evals|${s.id}`))?.at ?? 0;
      newEvals += (await db.assessments.where('studentId').equals(s.id).toArray()).filter((a) => a.updatedAt > seenE && a.authorId !== teacherId).length;
    }
    const upcoming = sessions.filter(isUpcoming);
    const deadlines = [
      ...upcoming.map((x) => ({ key: x.id, date: x.date, label: shortWhen(x.date, x.start), what: 'Séance', kind: 'seance' as const })),
      ...evals.map((a) => ({
        key: a.id,
        date: a.date,
        label: shortWhen(a.date),
        what: `${a.subject}${a.title ? ` · ${a.title}` : ''}${students.length > 1 ? ` (${students.find((s) => s.id === a.studentId)?.firstName})` : ''}`,
        kind: 'eval' as const,
      })),
    ]
      .sort((x, y) => x.date.localeCompare(y.date))
      .slice(0, 5);
    return { students, files, unread, next, newEvals, deadlines, done: done.length, minutes: done.reduce((a, s) => a + s.duration, 0), per };
  }, [group.id, teacherId]);

  const go = (tab: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    nav(`/prof/soutien/${group.id}?onglet=${tab}`);
  };
  return (
    <div className="panel strong tile-soutien" role="link" tabIndex={0} onClick={() => nav(`/prof/soutien/${group.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/prof/soutien/${group.id}`)}>
      <div className="stack" style={{ gap: 10, minWidth: 0 }}>
        <div className="row" style={{ gap: 10 }}>
          <h2 style={{ margin: 0 }}>{group.name}</h2>
          {(group.tracks ?? []).map((t) => (
            <span key={t.subject} className="tag plain">
              {trackLabel(t)}
            </span>
          ))}
        </div>
        {d && (
          <>
            {/* Ordinateur : pictos, calendrier des révisions et boîtes sur une même ligne (cadre moins haut) */}
            <div className="tile-main">
            <div className="row" style={{ gap: 14 }}>
              <button className="tile-ind" title={d.unread ? `${d.unread} message(s) non lu(s)` : 'Messages'} onClick={go('messages')}>
                <Icon name="mail" size={28} />
                <Badge n={d.unread} />
              </button>
              <button className="tile-ind" title={d.files ? `${d.files} document(s) déposé(s) non vu(s)` : 'Documents'} onClick={go('seances')}>
                <Icon name="file" size={28} />
                <Badge n={d.files} />
              </button>
              <button className="tile-ind" title={d.newEvals ? `${d.newEvals} évaluation(s) nouvelle(s) ou complétée(s)` : 'Évaluations'} onClick={go('evaluations')}>
                <Icon name="eval" size={28} />
                <Badge n={d.newEvals} />
              </button>
              {d.per.map(({ s, ledger }) => {
                if (ledger.free) return null;
                const color = ledger.balance < 0 ? 'var(--bad)' : ledger.balance > 0 ? 'var(--ok)' : '#9a968d';
                const bg = ledger.balance < 0 ? 'var(--bad-bg)' : ledger.balance > 0 ? 'var(--ok-bg)' : 'var(--calm)';
                return (
                  <button key={s.id} className="tile-ind tile-money" style={{ color, background: bg }} onClick={go('reglements')} title="Solde des règlements">
                    <Icon name="wallet" size={28} />
                    <span>
                      {d.students.length > 1 ? `${s.firstName} : ` : ''}
                      {ledger.balance < 0 ? money(-ledger.balance, ledger.currency) : ledger.balance > 0 ? `+${money(ledger.balance, ledger.currency)}` : 'à jour'}
                    </span>
                  </button>
                );
              })}
            </div>
            {d.per.map(({ s, counts, dist }) => (
              <div key={s.id} className="tile-cards" onClick={go('flashcards')} title="Flashcards">
                {d.students.length > 1 && <b className="small">{s.firstName}</b>}
                <Heatmap counts={counts} weeks={12} />
                <Boxes dist={dist} compact />
              </div>
            ))}
            </div>
            <span className="small muted">{d.done ? `${d.done} séance(s) faite(s) · ${durationLabel(d.minutes)}` : 'aucune séance faite'}</span>
          </>
        )}
      </div>
      {d && (
        <div className="tile-deadlines stack" style={{ gap: 6 }}>
          <b className="small">Échéances</b>
          {!d.deadlines.length && <span className="small muted">Rien de prévu.</span>}
          {d.deadlines.map((x) => (
            <button
              key={x.key}
              className={'tile-deadline ' + x.kind}
              onClick={go(x.kind === 'eval' ? 'evaluations' : 'seances')}
              title={`${x.label} — ${x.what}`}
            >
              <Icon name={x.kind === 'eval' ? 'alert' : 'calendar'} size={15} />
              <b>{x.label}</b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
