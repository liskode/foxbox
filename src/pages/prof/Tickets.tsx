import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';

export function Tickets() {
  const { id } = useParams();
  const group = useLiveQuery(() => db.groups.get(id!), [id]);
  const students = useLiveQuery(async () => {
    const ms = await db.memberships.where('groupId').equals(id!).toArray();
    const s = await db.students.bulkGet(ms.map((m) => m.studentId));
    return s.filter(Boolean).map((x) => x!).sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [id], []);
  const url = location.origin + location.pathname;

  return (
    <div className="page stack">
      <div className="spread noprint">
        <Link to={`/prof/classes/${id}`} className="small muted">
          ← {group?.name}
        </Link>
        <button className="btn primary" onClick={() => print()}>
          🖨 Imprimer
        </button>
      </div>
      <div className="tickets">
        {students.map((s) => (
          <div key={s.id} className="ticket">
            <img src="./logo.png" alt="" />
            <div>
              <div className="who">
                {s.firstName} {s.lastName} <span className="muted small">· {group?.name}</span>
              </div>
              <div className="small muted">{url.replace(/^https?:\/\//, '')}</div>
              <div className="cred">
                Identifiant : <b>{s.login}</b>
              </div>
              <div className="cred">
                Mot de passe : <b>{s.password}</b>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
