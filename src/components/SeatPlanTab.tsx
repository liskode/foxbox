// Plan de classe : les élèves de la classe placés sur les places d'une salle.
// Un clic sur un élève puis sur une place l'y installe ; un clic sur deux places les échange.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type Group, type Student, shortName } from '../lib/db';
import { useAuth } from '../lib/auth';
import { autoPlace, loadRooms, savePlans, seatKey, timetableRooms, type Room, type SeatPlan } from '../lib/rooms';
import { Avatar } from './Avatar';
import { FlagBadges, useAllFlags } from './StudentNote';

type Pick = { student: string } | { seat: string } | null;

function PlanGrid({
  room,
  plan,
  students,
  pick,
  onSeat,
  flip,
  cell,
}: {
  room: Room;
  plan: SeatPlan;
  students: Map<string, Student>;
  pick: Pick;
  onSeat?: (k: string) => void;
  flip: boolean;
  cell: number;
}) {
  const flags = useAllFlags();
  const seats = new Set(room.seats);
  const rows = Array.from({ length: room.rows }, (_, r) => r);
  const cols = Array.from({ length: room.cols }, (_, c) => c);
  if (flip) {
    rows.reverse();
    cols.reverse();
  }
  const board = (
    <div
      style={{
        textAlign: 'center',
        background: '#2f4f3f',
        color: '#fff',
        borderRadius: 6,
        fontWeight: 800,
        fontSize: '0.8rem',
        padding: 3,
        width: '60%',
        margin: '0 auto',
      }}
    >
      Tableau
    </div>
  );
  return (
    <div className="stack" style={{ gap: 8 }}>
      {!flip && board}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${room.cols}, ${cell}px)`, // Rangées sans place (allées) réduites pour un plan plus compact ; la largeur des colonnes ne change pas
          gridTemplateRows: rows.map((r) => (cols.some((c) => seats.has(seatKey(r, c))) ? `${cell}px` : `${Math.round(cell / 5)}px`)).join(' '),
          justifyContent: 'center',
        }}
      >
        {rows.flatMap((r) =>
          cols.map((c) => {
            const k = seatKey(r, c);
            if (!seats.has(k)) return <div key={k} />;
            const s = students.get(plan.seats[k]);
            const picked = (pick && 'seat' in pick && pick.seat === k) || (pick && 'student' in pick && s && pick.student === s.id);
            return (
              <div
                key={k}
                onClick={() => onSeat?.(k)}
                title={s ? `${s.firstName} ${s.lastName}` : 'Place libre'}
                style={{
                  border: `1.5px solid ${picked ? 'var(--ink)' : '#00000033'}`,
                  outline: picked ? '3px solid var(--matiere)' : undefined,
                  background: s ? '#fff8e6' : '#f6f4ef',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  overflow: 'hidden',
                  cursor: onSeat ? 'pointer' : 'default',
                  fontSize: cell > 90 ? '0.85rem' : '0.72rem',
                  lineHeight: 1.05,
                  textAlign: 'center',
                  padding: 2,
                }}
              >
                {s ? (
                  <>
                    <Avatar student={s} size={Math.round(cell * 0.5)} zoom={!!onSeat} />
                    <b>{s.firstName}</b>
                    <FlagBadges flags={flags.get(s.id)} />
                    <span className="muted">{s.lastName.slice(0, 12)}</span>
                  </>
                ) : (
                  <span className="muted">+</span>
                )}
              </div>
            );
          }),
        )}
      </div>
      {flip && board}
    </div>
  );
}

export function SeatPlanTab({ group }: { group: Group }) {
  const { session } = useAuth();
  const rooms = useLiveQuery(() => loadRooms(session!.id), [session?.id], [] as Room[]);
  const usual = useLiveQuery(async () => (await timetableRooms(session!.id, group, await db.groups.toArray())).usual, [session?.id, group.id]);
  const allStudents = useLiveQuery(
    async () => {
      const ms = await db.memberships.where('groupId').equals(group.id).toArray();
      return ((await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[]).sort(
        (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
      );
    },
    [group.id],
    [] as Student[],
  );
  const plans = group.seatPlans ?? [];
  // ?salle= : arrivée depuis la page Élèves (plan de cette classe dans cette salle)
  const [params] = useSearchParams();
  const wantedRoom = params.get('salle');
  const [planId, setPlanId] = useState<string | null>(null);
  const plan =
    plans.find((p) => p.id === planId) ??
    (wantedRoom && !planId ? plans.find((p) => p.roomId === wantedRoom) : undefined) ??
    (wantedRoom && !planId ? undefined : plans[0]);
  const room = rooms.find((r) => r.id === plan?.roomId);
  const [pick, setPick] = useState<Pick>(null);
  const [flip, setFlip] = useState(false);
  const [big, setBig] = useState(false);

  const flags = useAllFlags();
  // Plan d'un sous-groupe : seuls ses élèves
  const sub = group.subgroups?.find((x) => x.id === plan?.subgroupId);
  const students = sub ? allStudents.filter((s) => sub.studentIds.includes(s.id)) : allStudents;
  const byId = new Map(students.map((s) => [s.id, s]));
  const validSeats = new Set(room?.seats ?? []);
  const placed = new Set(
    Object.entries(plan?.seats ?? {})
      .filter(([k, id]) => validSeats.has(k) && byId.has(id))
      .map(([, id]) => id),
  );
  const unplaced = students.filter((s) => !placed.has(s.id));

  const setSeats = (seats: Record<string, string>) =>
    plan &&
    savePlans(
      group,
      plans.map((p) => (p.id === plan.id ? { ...p, seats } : p)),
    );

  // Nouveau plan : élèves (classe entière ou sous-groupe), salle (parmi celles dessinées), puis nom
  const [creating, setCreating] = useState<{ roomId: string; name: string; subgroupId?: string } | null>(null);
  function createPlan(roomId?: string) {
    if (!rooms.length) return;
    const r = rooms.find((x) => x.id === roomId) ?? rooms.find((x) => x.name === usual) ?? rooms[0];
    setCreating({ roomId: r.id, name: plans.length ? `Plan ${plans.length + 1}` : 'Cours' });
  }
  async function confirmCreate() {
    if (!creating?.name.trim()) return;
    const p: SeatPlan = { id: uid(), name: creating.name.trim(), roomId: creating.roomId, subgroupId: creating.subgroupId, seats: {} };
    await savePlans(group, [...plans, p]);
    setPlanId(p.id);
    setCreating(null);
  }

  function onSeat(k: string) {
    if (!plan) return;
    const seats = { ...plan.seats };
    const occupant = seats[k];
    if (pick && 'student' in pick) {
      // Élève choisi dans la liste (ou sur une place) → cette place
      for (const [kk, id] of Object.entries(seats)) if (id === pick.student) delete seats[kk];
      seats[k] = pick.student;
      setSeats(seats);
      setPick(null);
    } else if (pick && 'seat' in pick) {
      // Deux places : on échange
      if (pick.seat !== k) {
        const a = seats[pick.seat];
        if (occupant) seats[pick.seat] = occupant;
        else delete seats[pick.seat];
        if (a) seats[k] = a;
        else delete seats[k];
        setSeats(seats);
      }
      setPick(null);
    } else if (occupant) setPick({ seat: k });
  }

  function printPlan() {
    document.body.classList.add('printing-plan');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-plan');
    }, 300);
  }

  if (!rooms.length)
    return (
      <div className="notice">
        Dessinez d'abord votre salle dans <Link to="/prof/salles">⚙️ Réglages › Salles</Link> (cases cochées sur un quadrillage).
      </div>
    );

  return (
    <div className="stack">
      <div className="spread">
        <div className="row" style={{ gap: 6 }}>
          {plans.map((p) => (
            <button key={p.id} className={'btn small' + (p.id === plan?.id ? ' primary' : ' ghost')} onClick={() => setPlanId(p.id)}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
                <span>{p.name}</span>
                <span className="muted" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                  {shortName(group.name)} · {rooms.find((r) => r.id === p.roomId)?.name ?? '?'} ·{' '}
                  {p.subgroupId ? group.subgroups?.find((x) => x.id === p.subgroupId)?.name ?? 'groupe supprimé' : 'classe entière'}
                </span>
              </span>
            </button>
          ))}
          <button className="btn small" onClick={() => createPlan()}>
            + Nouveau plan
          </button>
        </div>
        {plan && (
          <div className="row" style={{ gap: 6 }}>
            {(group.subgroups?.length ?? 0) > 0 && (
              <select
                value={plan.subgroupId ?? ''}
                title="Élèves de ce plan"
                onChange={(e) =>
                  savePlans(
                    group,
                    plans.map((p) => (p.id === plan.id ? { ...p, subgroupId: e.target.value || undefined } : p)),
                  )
                }
              >
                <option value="">Toute la classe</option>
                {group.subgroups!.map((sg) => (
                  <option key={sg.id} value={sg.id}>
                    {sg.name}
                  </option>
                ))}
              </select>
            )}
            <label className="row small" style={{ gap: 4 }}>
              <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} /> Vue depuis le bureau
            </label>
            <button className="btn small ghost" onClick={() => setBig(true)}>
              ⛶ En grand
            </button>
            <button className="btn small ghost" onClick={printPlan}>
              🖨 Imprimer
            </button>
            <button
              className="btn small ghost"
              onClick={() => {
                const name = prompt('Nom du plan', plan.name);
                if (name)
                  savePlans(
                    group,
                    plans.map((p) => (p.id === plan.id ? { ...p, name } : p)),
                  );
              }}
            >
              Renommer
            </button>
            <button
              className="btn small danger"
              onClick={() =>
                confirm(`Supprimer le plan « ${plan.name} » ?`) &&
                savePlans(
                  group,
                  plans.filter((p) => p.id !== plan.id),
                )
              }
            >
              Supprimer
            </button>
          </div>
        )}
      </div>

      {creating && (
        <div className="panel stack" style={{ gap: 10, borderColor: 'var(--matiere)' }}>
          <b>Nouveau plan de {shortName(group.name)}</b>
          <div className="row" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 700 }}>
              1. Élèves :
            </span>
            <button className={'btn small' + (!creating.subgroupId ? ' primary' : ' ghost')} onClick={() => setCreating({ ...creating, subgroupId: undefined })}>
              Classe entière
            </button>
            {(group.subgroups ?? []).map((sg) => (
              <button
                key={sg.id}
                className={'btn small' + (creating.subgroupId === sg.id ? ' primary' : ' ghost')}
                style={{ borderColor: sg.color }}
                onClick={() => setCreating({ ...creating, subgroupId: sg.id, name: creating.name.startsWith('Plan ') || creating.name === 'Cours' ? sg.name : creating.name })}
              >
                {sg.name} <span className="muted">({sg.studentIds.length})</span>
              </button>
            ))}
            {!group.subgroups?.length && <span className="small muted">(pas de sous-groupe : créez-en dans la vue d'ensemble de la classe)</span>}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 700 }}>
              2. Salle :
            </span>
            {rooms.map((r) => (
              <button key={r.id} className={'btn small' + (creating.roomId === r.id ? ' primary' : ' ghost')} onClick={() => setCreating({ ...creating, roomId: r.id })}>
                {r.name} <span className="muted">({r.seats.length} places)</span>
              </button>
            ))}
            <Link to="/prof/salles" className="btn small ghost">
              + Ajouter une salle
            </Link>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 700 }}>
              3. Nom :
            </span>
            <input
              autoFocus
              value={creating.name}
              onChange={(e) => setCreating({ ...creating, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && confirmCreate()}
              placeholder="Cours, TP, Demi-groupe 1…"
              style={{ width: 220 }}
            />
            <button className="btn small primary" disabled={!creating.name.trim()} onClick={confirmCreate}>
              Créer le plan
            </button>
            <button className="btn small ghost" onClick={() => setCreating(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
      {!plan ? (
        wantedRoom && rooms.some((r) => r.id === wantedRoom) ? (
          <div className="notice row">
            Pas encore de plan de {shortName(group.name)} en {rooms.find((r) => r.id === wantedRoom)!.name}.
            <button className="btn small primary" onClick={() => createPlan(wantedRoom)}>
              Créer ce plan
            </button>
          </div>
        ) : (
          <div className="notice">Créez un plan pour cette classe{usual ? ` (salle habituelle : ${usual})` : ''}.</div>
        )
      ) : !room ? (
        <div className="notice">La salle de ce plan a été supprimée.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(200px, 260px)', gap: 16, alignItems: 'start' }}>
          <div className="panel" style={{ overflowX: 'auto' }}>
            <PlanGrid room={room} plan={plan} students={byId} pick={pick} onSeat={onSeat} flip={flip} cell={76} />
          </div>
          <div className="stack" style={{ gap: 12 }}>
            <div className="panel stack" style={{ gap: 6 }}>
              <b>
                {placed.size}/{students.length} placés · {room.seats.length} places
              </b>
              <div className="row" style={{ gap: 4 }}>
                <button
                  className="btn small"
                  onClick={() => confirm('Placer toute la classe par ordre alphabétique ?') && setSeats(autoPlace(room, students, 'alpha'))}
                >
                  A → Z
                </button>
                <button
                  className="btn small"
                  onClick={() => confirm('Placer toute la classe au hasard ?') && setSeats(autoPlace(room, students, 'random'))}
                >
                  🎲 Au hasard
                </button>
                <button className="btn small ghost" onClick={() => confirm('Retirer tous les élèves du plan ?') && setSeats({})}>
                  Vider
                </button>
              </div>
              {pick && 'seat' in pick && plan.seats[pick.seat] && (
                <div className="notice small">
                  {byId.get(plan.seats[pick.seat])?.firstName} : cliquez sur une autre place pour échanger, ou{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const seats = { ...plan.seats };
                      delete seats[pick.seat];
                      setSeats(seats);
                      setPick(null);
                    }}
                  >
                    retirer du plan
                  </a>
                  .
                </div>
              )}
              <span className="small muted">Cliquez sur un élève puis sur une place. Cliquez sur deux places pour les échanger.</span>
              {unplaced.map((s) => {
                const on = pick && 'student' in pick && pick.student === s.id;
                return (
                  <button
                    key={s.id}
                    className={'btn small' + (on ? ' primary' : ' ghost')}
                    style={{ justifyContent: 'flex-start', display: 'flex', gap: 6 }}
                    onClick={() => setPick(on ? null : { student: s.id })}
                  >
                    <Avatar student={s} size={24} zoom /> {s.firstName} {s.lastName} <FlagBadges flags={flags.get(s.id)} />
                  </button>
                );
              })}
              {!unplaced.length && <span className="small">✓ Tout le monde est placé.</span>}
            </div>
            <SavedPlans group={group} plans={plans} plan={plan} />
          </div>
        </div>
      )}

      {plan &&
        room &&
        createPortal(
          <div className={'plan-overlay' + (big ? ' show' : '')} onClick={() => setBig(false)}>
            <div className="spread noprint-inner" style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>
                {shortName(group.name)} — {plan.name} ({room.name})
              </h2>
              <span className="small muted">Cliquez pour fermer</span>
            </div>
            <PlanGrid
              room={room}
              plan={plan}
              students={byId}
              pick={null}
              flip={flip}
              cell={Math.max(70, Math.min(120, Math.floor((window.innerWidth - 80) / room.cols)))}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

// Versions sauvegardées d'un plan (date automatique, commentaire facultatif), la plus récente en haut
function SavedPlans({ group, plans, plan }: { group: Group; plans: SeatPlan[]; plan: SeatPlan }) {
  const saved = plan.saved ?? [];
  const update = (p: Partial<SeatPlan>) =>
    savePlans(
      group,
      plans.map((x) => (x.id === plan.id ? { ...x, ...p } : x)),
    );
  const when = (t: number) =>
    new Date(t).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="panel stack" style={{ gap: 6 }}>
      <div className="spread">
        <b>Plans sauvegardés</b>
        <button
          className="btn small primary"
          onClick={() => {
            const comment = prompt('Commentaire (facultatif) : ex. « après le conseil de classe », « contrôle »', '');
            if (comment === null) return;
            update({ saved: [{ id: uid(), at: Date.now(), comment: comment.trim() || undefined, seats: { ...plan.seats } }, ...saved] });
          }}
        >
          💾 Sauvegarder
        </button>
      </div>
      {saved.map((v) => (
        <div key={v.id} className="stack" style={{ gap: 2, borderTop: '1px solid var(--muted-line)', paddingTop: 6 }}>
          <div className="spread" style={{ flexWrap: 'nowrap' }}>
            <span className="small" style={{ fontWeight: 700 }}>
              {when(v.at)}
            </span>
            <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              <button
                className="btn small ghost"
                title="Remettre les élèves aux places de cette version"
                onClick={() => confirm(`Remettre le plan tel qu'il était le ${when(v.at)} ?`) && update({ seats: { ...v.seats } })}
              >
                Restaurer
              </button>
              <button
                className="btn small ghost"
                title="Supprimer cette sauvegarde"
                onClick={() => confirm('Supprimer cette sauvegarde ?') && update({ saved: saved.filter((x) => x.id !== v.id) })}
              >
                ✕
              </button>
            </span>
          </div>
          {v.comment && <span className="small muted">{v.comment}</span>}
          <span className="small muted">{Object.keys(v.seats).length} élève(s) placé(s)</span>
        </div>
      ))}
      {!saved.length && <span className="small muted">Aucune sauvegarde. Sauvegardez le plan avant de le modifier pour pouvoir y revenir.</span>}
    </div>
  );
}
