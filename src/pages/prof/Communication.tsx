// Communication : messagerie avec les élèves et les parents de toutes les classes (comme en soutien),
// et rendez-vous parents-professeurs (plages de disponibilité découpées en créneaux, réservés par les parents).
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, byName, groupStudents, isClass, uid, type Group, type Meeting, type Student } from '../../lib/db';
import { unreadIn } from '../../lib/messages';
import { slotsByDay, slotEnd, slotTime, teacherBook, isClosed } from '../../lib/meetings';
import { dayName } from '../../components/Soutien';
import { frDate, today } from '../../lib/dates';
import { Chat } from '../../components/Chat';
import { confirmBox } from '../../components/Dialog';
import { toast } from '../../components/Toast';
import { Icon } from '../../components/Icon';

export function Communication() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('onglet') === 'rdv' ? 'rdv' : 'messages';
  return (
    <div className="page stack">
      <div className="spread noprint">
        <h1 className="title" style={{ margin: 0 }}>
          Communication
        </h1>
        <div className="seg">
          <button className={tab === 'messages' ? 'on' : ''} onClick={() => setParams({})}>
            <Icon name="message" size={16} /> Messages
          </button>
          <button className={tab === 'rdv' ? 'on' : ''} onClick={() => setParams({ onglet: 'rdv' })}>
            <Icon name="calendar" size={16} /> Rendez-vous parents
          </button>
        </div>
      </div>
      {tab === 'messages' ? <Messages /> : <Meetings />}
    </div>
  );
}

// ---------- Messages ----------

// Groupes du professeur (classes puis soutien), non archivés
function useMyGroups() {
  const { session } = useAuth();
  return useLiveQuery(
    async () =>
      (await db.groups.toArray())
        .filter((g) => g.teacherIds.includes(session!.id) && !g.archived)
        .sort((a, b) => Number(!isClass(a)) - Number(!isClass(b)) || a.name.localeCompare(b.name, 'fr', { numeric: true })),
    [session?.id],
    [] as Group[],
  );
}

function Messages() {
  const { session } = useAuth();
  const me = useLiveQuery(() => db.teachers.get(session!.id), [session?.id]);
  const groups = useMyGroups();
  const [params, setParams] = useSearchParams();
  const groupId = params.get('classe') ?? '';
  const studentId = params.get('eleve') ?? '';
  // Conversations récentes : élèves avec au moins un message, du plus récent au plus ancien, avec les non-lus
  const recent = useLiveQuery(
    async () => {
      const last = new Map<string, number>();
      for (const m of await db.messages.toArray())
        if (m.teacherId === session!.id && !m.evaluationId && m.thread !== 'groupe') last.set(m.studentId, Math.max(last.get(m.studentId) ?? 0, m.createdAt));
      const ids = [...last.keys()].sort((a, b) => last.get(b)! - last.get(a)!).slice(0, 12);
      const st = await db.students.bulkGet(ids);
      return Promise.all(ids.map(async (id, i) => ({ student: st[i], at: last.get(id)!, unread: await unreadIn(session!.id, session!.id, id) })));
    },
    [session?.id],
    [],
  );
  const students = useLiveQuery(
    async () => {
      if (!groupId) return [];
      const list = (await groupStudents(groupId)).sort(byName);
      return Promise.all(list.map(async (s) => ({ s, unread: await unreadIn(session!.id, session!.id, s.id) })));
    },
    [groupId, session?.id],
    [] as { s: Student; unread: number }[],
  );
  const current = useLiveQuery(() => (studentId ? db.students.get(studentId) : undefined), [studentId]);
  const pick = (id: string) => setParams({ ...(groupId ? { classe: groupId } : {}), eleve: id });
  if (!me) return null;
  return (
    <div className="comm-grid">
      <div className="stack" style={{ gap: 16 }}>
        <div className="panel stack" style={{ gap: 8 }}>
          <h3 className="panel-title">Classe</h3>
          <div className="row" style={{ gap: 6 }}>
            {groups.map((g) => (
              <button key={g.id} className={'btn small' + (g.id === groupId ? ' primary' : ' ghost')} onClick={() => setParams({ classe: g.id })}>
                {g.name}
              </button>
            ))}
          </div>
          {students.map(({ s, unread }) => (
            <button key={s.id} className={'comm-row' + (s.id === studentId ? ' on' : '')} onClick={() => pick(s.id)}>
              <span>
                <b>{s.lastName}</b> {s.firstName}
              </span>
              {unread > 0 && <span className="badge">{unread}</span>}
            </button>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="panel calm stack" style={{ gap: 4 }}>
            <h3 className="panel-title">Conversations récentes</h3>
            {recent.map(
              ({ student, at, unread }) =>
                student && (
                  <button key={student.id} className={'comm-row' + (student.id === studentId ? ' on' : '')} onClick={() => pick(student.id)}>
                    <span>
                      <b>{student.lastName}</b> {student.firstName} <span className="small muted">· {frDate(new Date(at).toISOString().slice(0, 10))}</span>
                    </span>
                    {unread > 0 && <span className="badge">{unread}</span>}
                  </button>
                ),
            )}
          </div>
        )}
      </div>
      <div>
        {current ? (
          <Chat
            key={current.id}
            teacherId={me.id}
            studentId={current.id}
            me={{ id: me.id, name: me.name }}
            role="prof"
            title={`Conversation au sujet de ${current.firstName} ${current.lastName}`}
            hint="Cochez les destinataires de chaque message (l'élève, ses parents) : chacun ne lit que les messages qui lui sont adressés. Les parents doivent avoir un accès (fiche Famille de l'élève)."
          />
        ) : (
          <div className="panel calm muted">Choisissez une classe puis un élève pour écrire à l'élève ou à ses parents.</div>
        )}
      </div>
    </div>
  );
}

// ---------- Rendez-vous parents-professeurs ----------

function Meetings() {
  const { session } = useAuth();
  const meetings = useLiveQuery(
    async () =>
      (await db.meetings.where('teacherId').equals(session!.id).toArray()).sort((a, b) => (b.ranges[0]?.date ?? '').localeCompare(a.ranges[0]?.date ?? '')),
    [session?.id],
    [] as Meeting[],
  );
  const [edit, setEdit] = useState<Meeting | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const me = useLiveQuery(() => db.teachers.get(session!.id), [session?.id]);
  function create() {
    setEdit({
      id: uid(),
      teacherId: session!.id,
      teacherName: me?.name ?? '',
      title: 'Rencontre parents-professeurs',
      groupIds: [],
      ranges: [{ date: today(), start: '16:30', end: '19:00' }],
      duration: 10,
      createdAt: Date.now(),
    });
  }
  if (edit) return <MeetingForm meeting={edit} onDone={(id) => (setEdit(null), id && setOpen(id))} />;
  const shown = meetings.find((m) => m.id === open);
  if (shown) return <MeetingView meeting={shown} onBack={() => setOpen(null)} onEdit={() => setEdit(shown)} />;
  return (
    <div className="stack">
      <div className="spread">
        <span className="muted">
          Donnez vos disponibilités (un ou plusieurs jours) et la durée d'un rendez-vous : les parents des classes choisies réservent un créneau
          depuis leur espace, et peuvent le changer tant qu'il reste des créneaux libres.
        </span>
        <button className="btn primary" onClick={create}>
          <Icon name="plus" size={16} /> Nouvelle rencontre
        </button>
      </div>
      {!meetings.length && <div className="panel calm muted">Aucune rencontre pour l'instant.</div>}
      {meetings.map((m) => (
        <MeetingTile key={m.id} meeting={m} onOpen={() => setOpen(m.id)} />
      ))}
    </div>
  );
}

function MeetingTile({ meeting: m, onOpen }: { meeting: Meeting; onOpen: () => void }) {
  const info = useLiveQuery(
    async () => {
      const booked = await db.meetingBookings.where('meetingId').equals(m.id).count();
      const groups = (await db.groups.bulkGet(m.groupIds)).filter(Boolean) as Group[];
      const total = slotsByDay(m).reduce((n, d) => n + d.slots.length, 0);
      return { booked, total, groups: groups.map((g) => g.name).join(', ') };
    },
    [m],
  );
  return (
    <button className="panel strong spread" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={onOpen}>
      <span className="stack" style={{ gap: 2 }}>
        <b>{m.title}</b>
        <span className="small muted">
          {[...new Set(m.ranges.map((r) => r.date))].map((d) => `${dayName(d)} ${frDate(d)}`).join(' · ')} · {info?.groups || 'aucune classe'}
        </span>
      </span>
      <span className={'tag ' + (info && info.booked >= info.total ? 'warn' : 'ok')}>
        {info?.booked ?? 0} / {info?.total ?? 0} créneaux réservés
      </span>
    </button>
  );
}

function MeetingForm({ meeting, onDone }: { meeting: Meeting; onDone: (id?: string) => void }) {
  const [m, setM] = useState(meeting);
  const groups = useMyGroups().filter(isClass);
  const set = (patch: Partial<Meeting>) => setM({ ...m, ...patch });
  const setRange = (i: number, patch: Partial<Meeting['ranges'][number]>) => set({ ranges: m.ranges.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const total = slotsByDay(m).reduce((n, d) => n + d.slots.length, 0);
  const valid = m.title.trim() && m.groupIds.length && total > 0;
  async function save() {
    await db.meetings.put({ ...m, title: m.title.trim() });
    toast('Rencontre enregistrée : les parents peuvent réserver');
    onDone(m.id);
  }
  return (
    <div className="panel stack" style={{ maxWidth: 720 }}>
      <h3 className="panel-title">Rencontre parents-professeurs</h3>
      <label className="field">
        Titre
        <input value={m.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <div className="field">
        Classes concernées (leurs parents peuvent réserver)
        <div className="row" style={{ gap: 6 }}>
          {groups.map((g) => {
            const on = m.groupIds.includes(g.id);
            return (
              <button key={g.id} type="button" className={'btn small' + (on ? ' primary' : ' ghost')} onClick={() => set({ groupIds: on ? m.groupIds.filter((x) => x !== g.id) : [...m.groupIds, g.id] })}>
                {g.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="field">
        Disponibilités
        {m.ranges.map((r, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <input type="date" value={r.date} onChange={(e) => setRange(i, { date: e.target.value })} />
            de <input type="time" value={r.start} step={300} onChange={(e) => setRange(i, { start: e.target.value })} />
            à <input type="time" value={r.end} step={300} onChange={(e) => setRange(i, { end: e.target.value })} />
            {m.ranges.length > 1 && (
              <button className="btn small ghost" title="Retirer cette plage" onClick={() => set({ ranges: m.ranges.filter((_, j) => j !== i) })}>
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        ))}
        <div>
          <button
            className="btn small ghost"
            onClick={() => {
              const last = m.ranges[m.ranges.length - 1];
              set({ ranges: [...m.ranges, { ...(last ?? { date: today(), start: '16:30', end: '19:00' }) }] });
            }}
          >
            <Icon name="plus" size={14} /> Ajouter une plage (autre jour ou autre horaire)
          </button>
        </div>
      </div>
      <div className="row" style={{ gap: 16, alignItems: 'flex-end' }}>
        <label className="field">
          Durée d'un rendez-vous
          <select value={m.duration} onChange={(e) => set({ duration: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30, 45, 60].map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Réservations jusqu'au (facultatif)
          <input type="date" value={m.closesOn ?? ''} onChange={(e) => set({ closesOn: e.target.value || undefined })} />
        </label>
        <span className="tag ok">{total} créneaux</span>
        {m.closesOn && m.closesOn < today() && <span className="tag bad">date limite passée : les parents ne peuvent pas réserver</span>}
      </div>
      <label className="field">
        Lieu (facultatif)
        <input value={m.place ?? ''} placeholder="Salle B12" onChange={(e) => set({ place: e.target.value || undefined })} />
      </label>
      <label className="field">
        Message aux parents (facultatif)
        <textarea value={m.info ?? ''} onChange={(e) => set({ info: e.target.value || undefined })} style={{ minHeight: 70 }} />
      </label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={() => onDone()}>
          Annuler
        </button>
        <button className="btn primary" disabled={!valid} onClick={save}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function MeetingView({ meeting: m, onBack, onEdit }: { meeting: Meeting; onBack: () => void; onEdit: () => void }) {
  const data = useLiveQuery(
    async () => {
      const bookings = await db.meetingBookings.where('meetingId').equals(m.id).toArray();
      const groups = (await db.groups.bulkGet(m.groupIds)).filter(Boolean) as Group[];
      const students: (Student & { group: string })[] = [];
      for (const g of groups) for (const s of (await groupStudents(g.id)).sort(byName)) students.push({ ...s, group: g.name });
      return { bookings, groups, students };
    },
    [m],
  );
  if (!data) return null;
  const bySlot = new Map(data.bookings.map((b) => [b.slot, b]));
  const days = slotsByDay(m);
  const valid = new Set(days.flatMap((d) => d.slots));
  const orphans = data.bookings.filter((b) => !valid.has(b.slot));
  const booked = new Set(data.bookings.map((b) => b.studentId));
  const without = data.students.filter((s) => !booked.has(s.id));
  async function cancel(id: string, name: string) {
    if (!(await confirmBox(`Annuler le rendez-vous de ${name} ? La famille pourra en reprendre un autre.`))) return;
    const b = await db.meetingBookings.get(id);
    await db.meetingBookings.delete(id);
    toast(`Rendez-vous de ${name} annulé`, { undo: () => b && db.meetingBookings.put(b) });
  }
  async function remove() {
    if (!(await confirmBox(`Supprimer la rencontre « ${m.title} » et ses ${data!.bookings.length} rendez-vous ?`))) return;
    for (const b of data!.bookings) await db.meetingBookings.delete(b.id);
    await db.meetings.delete(m.id);
    onBack();
  }
  return (
    <div className="stack">
      <div className="spread noprint">
        <button className="btn ghost" onClick={onBack}>
          ← Toutes les rencontres
        </button>
        <div className="row">
          <button className="btn" onClick={onEdit}>
            <Icon name="edit" size={16} /> Modifier
          </button>
          <button className="btn" onClick={() => window.print()}>
            <Icon name="print" size={16} /> Imprimer
          </button>
          <button className="btn ghost" onClick={remove} title="Supprimer la rencontre">
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>
      <div>
        <h2 style={{ margin: 0 }}>{m.title}</h2>
        <span className="muted">
          {data.groups.map((g) => g.name).join(', ')} · rendez-vous de {m.duration} min{m.place ? ` · ${m.place}` : ''}
          {m.closesOn ? ` · réservations ${isClosed(m) ? 'closes depuis le' : "jusqu'au"} ${frDate(m.closesOn)}` : ''} · {data.bookings.length} famille(s) inscrite(s) sur{' '}
          {data.students.length}
        </span>
      </div>
      <div className="meeting-days">
        {days.map((d) => (
          <div key={d.date} className="panel stack" style={{ gap: 0 }}>
            <h3 className="panel-title" style={{ marginBottom: 8 }}>
              {dayName(d.date)} {frDate(d.date)}
            </h3>
            {d.slots.map((slot) => {
              const b = bySlot.get(slot);
              return (
                <div key={slot} className="meeting-row">
                  <span className="small slot-time">
                    {slotTime(slot)}
                  </span>
                  {b ? (
                    <>
                      <span style={{ flex: 1 }}>
                        <Link to={`/prof/eleves/${b.studentId}`}>{b.studentName}</Link>
                        <span className="small muted"> · {b.bookedBy === 'prof' ? 'inscrit par vous' : b.parentName}</span>
                      </span>
                      <button className="btn small ghost noprint" title="Annuler ce rendez-vous" onClick={() => cancel(b.id, b.studentName)}>
                        <Icon name="x" size={14} />
                      </button>
                    </>
                  ) : (
                    <select
                      className="noprint"
                      value=""
                      style={{ color: 'var(--muted, #8a867d)' }}
                      onChange={async (e) => {
                        if (e.target.value) await teacherBook(m, e.target.value, slot);
                      }}
                    >
                      <option value="">libre · inscrire une famille…</option>
                      {/* Par classe, puis par prénom : taper les premières lettres du prénom trouve l'élève */}
                      {[...new Set(without.map((s) => s.group))].map((g) => (
                        <optgroup key={g} label={g}>
                          {without
                            .filter((s) => s.group === g)
                            .sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr') || a.lastName.localeCompare(b.lastName, 'fr'))
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.firstName} {s.lastName} ({g})
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {orphans.length > 0 && (
        <div className="panel note stack" style={{ gap: 4 }}>
          <b>Rendez-vous en dehors des horaires actuels (à déplacer ou annuler)</b>
          {orphans.map((b) => (
            <div key={b.id} className="row" style={{ gap: 8 }}>
              <span className="small">
                {dayName(b.slot.slice(0, 10))} {frDate(b.slot.slice(0, 10))} à {slotTime(b.slot)} – {slotEnd(b.slot, m.duration)} · {b.studentName}
              </span>
              <button className="btn small ghost" onClick={() => cancel(b.id, b.studentName)}>
                Annuler
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="panel calm stack" style={{ gap: 4 }}>
        <h3 className="panel-title">Sans rendez-vous ({without.length})</h3>
        {!without.length && <span className="small">Toutes les familles ont réservé.</span>}
        {[...new Set(without.map((s) => s.group))].map((g) => {
          const list = without.filter((s) => s.group === g).sort((a, b) => a.firstName.localeCompare(b.firstName, 'fr') || a.lastName.localeCompare(b.lastName, 'fr'));
          return (
            <div key={g} className="small">
              <b>
                {g} ({list.length}) :
              </b>{' '}
              {list.map((s) => `${s.firstName} ${s.lastName}`).join(' · ')}
            </div>
          );
        })}
      </div>
    </div>
  );
}
