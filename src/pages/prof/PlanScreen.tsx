// Plan de classe en grand, dans sa propre fenêtre (à faire glisser sur l'écran du tableau).
// Pas de pastilles d'aménagement : l'affichage est vu par toute la classe.
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, shortName, type Student } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { loadRooms } from '../../lib/rooms';
import { PlanGrid, printCell } from '../../components/SeatPlanTab';

export function PlanScreen() {
  const { groupId, planId } = useParams();
  const [params] = useSearchParams();
  const flip = params.get('bureau') === '1';
  const { session } = useAuth();
  const group = useLiveQuery(() => db.groups.get(groupId!), [groupId]);
  const rooms = useLiveQuery(() => loadRooms(session!.id), [session?.id], []);
  const students = useLiveQuery(async () => {
    const ms = await db.memberships.where('groupId').equals(groupId!).toArray();
    return (await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[];
  }, [groupId], [] as Student[]);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const plan = group?.seatPlans?.find((p) => p.id === planId);
  const room = rooms.find((r) => r.id === plan?.roomId);
  useEffect(() => {
    if (group && plan) document.title = `Plan ${shortName(group.name)} · ${plan.name}`;
  }, [group, plan]);
  if (!group || !plan || !room) return <div className="page muted">Chargement du plan…</div>;
  const sub = group.subgroups?.find((x) => x.id === plan.subgroupId);

  return (
    <div style={{ padding: '14px 20px', background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="spread" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>
          {shortName(group.name)} · {plan.name} <span className="muted" style={{ fontWeight: 600 }}>— salle {room.name}{sub ? ` · ${sub.name}` : ''}</span>
        </h2>
        <span className="small muted">Astuce : faites glisser cette fenêtre sur l'écran du tableau, puis ⌃⌘F pour le plein écran.</span>
      </div>
      <PlanGrid
        room={room}
        plan={plan}
        students={new Map(students.map((s) => [s.id, s]))}
        pick={null}
        flip={flip}
        hideFlags
        cell={printCell(room, size.w - 60, size.h - 110, 220)}
      />
    </div>
  );
}
