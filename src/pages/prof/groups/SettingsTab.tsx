// Classe : onglet Réglages (nom, co-enseignants, archivage, suppression).
import { alertBox, ask, confirmBox } from '../../../components/Dialog';
import { toast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, shortName, type Group } from '../../../lib/db';
import { deleteGroup } from '../../../lib/students';
import { levelColors, levelOfName } from '../../../lib/units';
import { canEditGroup, isOwner, rightOf, type Right } from '../../../lib/access';
import { ReadOnlyZone } from '../../../components/ReadOnly';
import { callStudents, ONLINE } from '../../../lib/supabase';
import { syncNow } from '../../../lib/sync';
import { isDemo } from '../../../lib/demoMode';

export function DeleteGroup({ group }: { group: Group }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [orphans, setOrphans] = useState(true);
  const [busy, setBusy] = useState('');
  async function go() {
    if (!(await confirmBox(`Supprimer définitivement la classe « ${group.name} » ?`))) return;
    setBusy('Suppression…');
    try {
      const n = await deleteGroup(group.id, orphans);
      alertBox(`Classe supprimée${n ? `, ainsi que ${n} élève(s)` : ''}.`);
      nav('/prof/eleves');
    } catch (e) {
      setBusy('Erreur : ' + (e as Error).message);
    }
  }
  return (
    <div className="stack" style={{ borderTop: '2px dashed var(--muted-line)', paddingTop: 12 }}>
      {!open ? (
        <div>
          <button className="btn danger" onClick={() => setOpen(true)}>
            Supprimer la classe…
          </button>
        </div>
      ) : (
        <div className="notice stack" style={{ borderColor: 'var(--forgot)' }}>
          <b>Supprimer la classe « {group.name} »</b>
          <span className="small">Les publications de cette classe sont supprimées. Les flashcards et les séquences sont conservées.</span>
          <label className="row small" style={{ gap: 8, fontWeight: 700 }}>
            <input type="checkbox" checked={orphans} onChange={(e) => setOrphans(e.target.checked)} />
            Supprimer aussi les élèves qui ne sont dans aucune autre classe (comptes, photos, progression)
          </label>
          <div className="row">
            <button className="btn danger" onClick={go} disabled={!!busy}>
              Supprimer définitivement
            </button>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
          {busy && <span>{busy}</span>}
        </div>
      )}
    </div>
  );
}

export function TeachersTab({ group }: { group: Group }) {
  const { session } = useAuth();
  const owner = isOwner(group, session!.id);
  const ro = !canEditGroup(group, session!.id);
  // Renommer : la classe reprend la couleur de son niveau (déduit du nouveau nom)
  async function rename() {
    const name = (await ask('Renommer la classe', { label: 'Nom', value: group.name }))?.trim();
    if (!name || name === group.name) return;
    const before = { name: group.name, color: group.color };
    const lvl = levelOfName(name);
    const color = lvl ? (await levelColors(session!.id))[lvl] : group.color;
    await db.groups.update(group.id, { name, color });
    toast(`Classe renommée « ${name} »`, { undo: () => db.groups.update(group.id, before) });
  }
  return (
    <div className="panel stack">
      <ReadOnlyZone readOnly={ro} className="stack">
      <div className="row" style={{ gap: 8 }}>
        <span>
          Nom : <b>{group.name}</b>
        </span>
        <button className="btn small" onClick={rename}>
          Renommer
        </button>
      </div>
      <div className="small">
        Couleur : celle du niveau{' '}
        <span className="chip" style={{ background: group.color ?? 'var(--paper)' }}>
          {levelOfName(group.name) ?? 'niveau inconnu'}
        </span>{' '}
        — modifiable dans <Link to="/prof/reglages">Réglages › Couleurs des niveaux</Link>.
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <input type="checkbox" checked={!!group.studentsCanSuspend} onChange={(e) => db.groups.update(group.id, { studentsCanSuspend: e.target.checked })} />
        <span>
          Les élèves peuvent retirer des flashcards de leur pile <span className="small muted">(ils peuvent aussi les reprendre)</span>
        </span>
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <input type="checkbox" checked={!!group.studentsCanWrite} onChange={(e) => db.groups.update(group.id, { studentsCanWrite: e.target.checked })} />
        <span>
          Les élèves peuvent m'écrire <span className="small muted">(onglet Messages de leur espace ; sinon ils lisent seulement vos messages. Les parents peuvent toujours vous écrire)</span>
        </span>
      </label>
      </ReadOnlyZone>
      <h3 style={{ margin: '8px 0 0' }}>Co-enseignants</h3>
      <CoTeachers group={group} />
      {owner && (
      <div>
        <button
          className="btn ghost"
          onClick={async () =>
            (await confirmBox(group.archived ? 'Réactiver cette classe ?' : 'Archiver cette classe ? Les élèves gardent leurs comptes et leurs flashcards.')) &&
            db.groups.update(group.id, { archived: !group.archived })
          }
        >
          {group.archived ? 'Réactiver la classe' : 'Archiver la classe (fin d’année)'}
        </button>
      </div>
      )}
      {owner && <DeleteGroup group={group} />}
    </div>
  );
}

// Co-enseignants : le propriétaire de la classe choisit le droit de chaque collègue (aucun, lecture, modification)
// et peut autoriser l'adresse e-mail d'un collègue qui n'a pas encore de compte FoxBox.
function CoTeachers({ group }: { group: Group }) {
  const { session } = useAuth();
  const me = session!.id;
  const teachers = useLiveQuery(() => db.teachers.toArray(), [], []);
  const [email, setEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRight, setNewRight] = useState<'lecture' | 'modification'>('modification');
  const [sent, setSent] = useState<{ name: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ownerName = teachers.find((t) => t.id === group.teacherIds[0])?.name ?? 'un collègue';
  if (!isOwner(group, me))
    return (
      <span className="small">
        Classe de <b>{ownerName}</b>, partagée avec vous {rightOf(group, me) === 'modification' ? <>avec le droit de <b>modifier</b></> : <>en <b>lecture seule</b></>}.
        Seul {ownerName} choisit les co-enseignants.
      </span>
    );
  const others = teachers.filter((t) => t.id !== me).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  async function setRight(teacherId: string, name: string, r: Right) {
    const before = { teacherIds: group.teacherIds, editorIds: group.editorIds ?? [] };
    const teacherIds = r === 'aucun' ? group.teacherIds.filter((x) => x !== teacherId) : [...new Set([...group.teacherIds, teacherId])];
    const editorIds = r === 'modification' ? [...new Set([...(group.editorIds ?? []), teacherId])] : (group.editorIds ?? []).filter((x) => x !== teacherId);
    await db.groups.update(group.id, { teacherIds, editorIds });
    const label = r === 'aucun' ? 'n’a plus accès à la classe' : r === 'lecture' ? 'a accès à la classe en lecture seule' : 'peut modifier la classe';
    toast(`${name} ${label}`, { undo: () => db.groups.update(group.id, before) });
  }
  // Ajout d'un collègue par son e-mail : son compte est créé s'il n'en a pas, il rejoint la classe avec le droit choisi
  async function add() {
    const mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return alertBox('Adresse e-mail invalide.');
    setBusy(true);
    try {
      const r = await callStudents<{ name: string; created: boolean; password?: string }>({ action: 'addTeacher', groupId: group.id, email: mail, name: newName, right: newRight });
      setEmail('');
      setNewName('');
      syncNow();
      const site = `${location.origin}${location.pathname}`;
      setSent({
        name: r.name,
        text: r.created
          ? `Bonjour, je t'ai ajouté(e) comme co-enseignant(e) de la classe ${shortName(group.name)} dans FoxBox.\n` +
            `Pour te connecter : ${site}\nIdentifiant : ${mail}\nMot de passe provisoire : ${r.password}\n` +
            `À ta première connexion, FoxBox te demandera de choisir ton propre mot de passe.`
          : `Bonjour, je t'ai ajouté(e) comme co-enseignant(e) de la classe ${shortName(group.name)} dans FoxBox : ` +
            `tu la retrouves en te connectant à ${site} avec ton compte habituel.`,
      });
    } catch (e) {
      alertBox(`Ajout impossible : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="small muted">
        Vous êtes le professeur principal de cette classe. Lecture seule : votre collègue voit les élèves, la progression, les évaluations et les
        résultats de la classe. Modification : il peut aussi cocher les séances faites, corriger, modifier les évaluations de la classe et les
        séquences du niveau. Vos notes privées, aménagements, coordonnées des familles, absences et notes de classe restent à vous seul.
      </span>
      {others.map((t) => (
        <label key={t.id} className="row" style={{ gap: 8 }}>
          <select value={rightOf(group, t.id)} onChange={(e) => setRight(t.id, t.name, e.target.value as Right)}>
            <option value="aucun">Pas d’accès</option>
            <option value="lecture">Lecture seule</option>
            <option value="modification">Modification</option>
          </select>
          {t.name}
        </label>
      ))}
      {!others.length && <span className="small muted">Aucun collègue n’a encore de compte FoxBox.</span>}
      <form
        className="stack"
        style={{ gap: 8, borderTop: '1px solid var(--muted-line)', paddingTop: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <b className="small">Ajouter un collègue</b>
        <div className="row" style={{ gap: 8 }}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="son adresse e-mail" style={{ flex: 2, minWidth: 200 }} />
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="nom affiché (ex. H. Amane)" style={{ flex: 1, minWidth: 140 }} />
          <select value={newRight} onChange={(e) => setNewRight(e.target.value as 'lecture' | 'modification')}>
            <option value="lecture">Lecture seule</option>
            <option value="modification">Modification</option>
          </select>
          <button className="btn" type="submit" disabled={busy || !email.trim() || !ONLINE || isDemo()}>
            {busy ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
        <span className="small muted">
          S'il n'a pas encore de compte FoxBox, il est créé avec un mot de passe provisoire : vous recevez le message à lui envoyer. À sa première
          connexion, il choisit son propre mot de passe.
        </span>
      </form>
      {sent && (
        <div className="panel note stack" style={{ gap: 8 }}>
          <b className="small">{sent.name} est ajouté(e) à la classe. Message à lui envoyer :</b>
          <textarea readOnly value={sent.text} rows={5} style={{ fontFamily: 'var(--font)', fontSize: '0.9rem' }} onFocus={(e) => e.target.select()} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" type="button" onClick={() => navigator.clipboard.writeText(sent.text).then(() => toast('Message copié'))}>
              Copier le message
            </button>
            <button className="btn ghost" type="button" onClick={() => setSent(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
