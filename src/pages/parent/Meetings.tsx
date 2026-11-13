// Espace parents : rendez-vous avec les professeurs. Pour chaque rencontre ouverte à la classe de l'enfant, le parent
// choisit un créneau libre, peut le changer (dans la limite des créneaux encore libres) ou l'annuler. Pensé pour le téléphone.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, type Meeting, type Student } from '../../lib/db';
import { childrenLinks, type ChildLink } from '../../lib/parents';
import { bookSlot, cancelSlot, isClosed, nowSlot, slotEnd, slotsByDay, slotTime, takenSlots } from '../../lib/meetings';
import { dayName } from '../../components/Soutien';
import { frDate } from '../../lib/dates';
import { alertBox, confirmBox } from '../../components/Dialog';
import { toast } from '../../components/Toast';
import { RichText } from '../../components/CardFace';
import { Icon } from '../../components/Icon';

export function ParentMeetings() {
  const { session } = useAuth();
  const parent = useLiveQuery(() => db.parents.get(session!.id), [session?.id]);
  const children = useLiveQuery(
    async () => (parent ? ((await db.students.bulkGet(parent.studentIds)).filter(Boolean) as Student[]) : []),
    [parent],
    [] as Student[],
  );
  const [links, setLinks] = useState<ChildLink[] | null>(null);
  const ids = children.map((c) => c.id).join(',');
  useEffect(() => {
    if (ids) childrenLinks(ids.split(',')).then(setLinks);
  }, [ids]);
  const meetings = useLiveQuery(() => db.meetings.toArray(), [], [] as Meeting[]);
  if (!parent || !links) return null;
  // Rencontres de chaque enfant : celles ouvertes à l'une de ses classes, et pas encore passées
  const last = (m: Meeting) => slotsByDay(m).flatMap((d) => d.slots).pop() ?? '';
  const items = children.flatMap((c) =>
    meetings
      .filter((m) => m.groupIds.some((g) => links.some((l) => l.studentId === c.id && l.groupId === g)) && last(m) >= nowSlot().slice(0, 10))
      .map((m) => ({ child: c, meeting: m })),
  );
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>
        Rendez-vous
      </h1>
      {!items.length && <div className="notice">Aucune rencontre parents-professeurs ouverte pour l'instant.</div>}
      {items.map(({ child, meeting }) => (
        <MeetingCard key={meeting.id + child.id} meeting={meeting} child={child} parent={{ id: parent.id, name: parent.name }} several={children.length > 1} />
      ))}
    </div>
  );
}

function MeetingCard({ meeting: m, child, parent, several }: { meeting: Meeting; child: Student; parent: { id: string; name: string }; several: boolean }) {
  const mine = useLiveQuery(() => db.meetingBookings.get(`${m.id}|${child.id}`), [m.id, child.id]);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const refresh = () => takenSlots(m.id).then(setTaken);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000); // les autres familles réservent en même temps
    return () => clearInterval(t);
  }, [m.id, mine?.slot]); // eslint-disable-line react-hooks/exhaustive-deps
  const closed = isClosed(m);
  const now = nowSlot();
  const when = (slot: string) => `${dayName(slot.slice(0, 10))} ${frDate(slot.slice(0, 10))} à ${slotTime(slot)}`;

  async function choose(slot: string) {
    const ok = await confirmBox(mine ? `Changer pour le ${when(slot)} ?` : `Réserver le ${when(slot)} pour ${child.firstName} ?`, mine ? 'Changer' : 'Réserver');
    if (!ok) return;
    setBusy(true);
    const err = await bookSlot(m, child.id, slot, parent);
    setBusy(false);
    await refresh();
    if (err) return alertBox(err);
    toast(`Rendez-vous le ${when(slot)}`);
  }
  async function cancel() {
    if (!(await confirmBox(`Annuler le rendez-vous du ${when(mine!.slot)} ?`, 'Annuler le rendez-vous'))) return;
    const err = await cancelSlot(m, child.id);
    await refresh();
    if (err) return alertBox(err);
    toast('Rendez-vous annulé');
  }

  return (
    <div className="panel stack">
      <div>
        <h3 className="panel-title" style={{ margin: 0 }}>
          {m.title}
          {several ? ` · ${child.firstName}` : ''}
        </h3>
        <span className="small muted">
          {m.teacherName} · {m.duration} min{m.place ? ` · ${m.place}` : ''}
          {m.closesOn ? ` · réservation ${closed ? 'close depuis le' : "jusqu'au"} ${frDate(m.closesOn)}` : ''}
        </span>
      </div>
      {m.info && <RichText text={m.info} />}
      {mine ? (
        <div className="notice spread">
          <span>
            <Icon name="check" size={16} /> Votre rendez-vous : <b>{when(mine.slot)}</b> – {slotEnd(mine.slot, m.duration)}
          </span>
          {!closed && mine.slot > now && (
            <button className="btn small ghost" onClick={cancel}>
              Annuler
            </button>
          )}
        </div>
      ) : (
        !closed && <span className="small">Choisissez un créneau libre{mine ? '' : ` pour ${child.firstName}`} :</span>
      )}
      {!closed &&
        slotsByDay(m).map((d) => {
          const free = d.slots.filter((s) => s > now);
          if (!free.length) return null;
          return (
            <div key={d.date} className="stack" style={{ gap: 6 }}>
              <b className="small">
                {dayName(d.date)} {frDate(d.date)}
              </b>
              <div className="slot-grid">
                {free.map((s) => {
                  const isMine = mine?.slot === s;
                  const isTaken = !isMine && taken.has(s);
                  return (
                    <button
                      key={s}
                      className={'btn small' + (isMine ? ' primary' : isTaken ? ' taken' : '')}
                      disabled={busy || isTaken}
                      title={isTaken ? 'Déjà pris' : isMine ? 'Votre rendez-vous' : mine ? 'Changer pour ce créneau' : 'Réserver ce créneau'}
                      onClick={() => !isMine && choose(s)}
                    >
                      {slotTime(s)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      {mine && !closed && <span className="small muted">Pour changer d'horaire, touchez un autre créneau libre.</span>}
    </div>
  );
}
