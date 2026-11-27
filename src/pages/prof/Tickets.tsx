import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, byName, groupStudents } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';

// Texte imprimé sur chaque fiche (réglable dans les Réglages) ; [identifiants] marque la place de l'identifiant et du mot de passe
export const TICKET_SLOT = '[identifiants]';
export const DEFAULT_TICKET_TEXT = `Connecte-toi à l'adresse foxbox.physifox.fr avec les identifiants suivants :
${TICKET_SLOT}
Tu pourras réviser tes flashcards et accéder aux documents de cours et aux évaluations.`;

export function Tickets() {
  const { session } = useAuth();
  const me = useLiveQuery(() => db.teachers.get(session!.id), [session?.id]);
  const text = me?.ticketText?.trim() || DEFAULT_TICKET_TEXT;
  const [before, after = ''] = text.includes(TICKET_SLOT) ? text.split(TICKET_SLOT) : [text, ''];
  const { id } = useParams();
  const group = useLiveQuery(() => db.groups.get(id!), [id]);
  const students = useLiveQuery(async () => {
    return (await groupStudents(id!)).sort(byName);
  }, [id], []);

  return (
    <div className="page stack">
      <div className="spread noprint">
        <Link to={`/prof/classes/${id}`} className="small muted">
          ← {group?.name}
        </Link>
        <button className="btn primary" onClick={() => print()}>
          <Icon name="print" size={16} /> Imprimer
        </button>
      </div>
      <div className="tickets">
        {students.map((s) => (
          <div key={s.id} className="ticket">
            {s.photoId ? <Avatar student={s} size={48} /> : <img src="./logo.png" alt="" />}
            <div>
              <div className="who">
                {s.firstName} {s.lastName} <span className="muted small">· {group?.name}</span>
              </div>
              {before.trim() && <div className="ticket-text">{before.trim()}</div>}
              <div className="cred">
                Identifiant : <b>{s.login}</b>
              </div>
              <div className="cred">
                Mot de passe : <b>{s.password}</b>
              </div>
              {after.trim() && <div className="ticket-text">{after.trim()}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
