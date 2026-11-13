// Classe : onglet Réglages (nom, co-enseignants, archivage, suppression).
import { alertBox, ask, confirmBox } from '../../../components/Dialog';
import { toast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Group } from '../../../lib/db';
import { deleteGroup } from '../../../lib/students';
import { levelColors, levelOfName } from '../../../lib/units';

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
  const teachers = useLiveQuery(() => db.teachers.toArray(), [], []);
  const { session } = useAuth();
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
      <h3 style={{ margin: '8px 0 0' }}>Co-enseignants</h3>
      <span className="small muted">
        Plusieurs professeurs peuvent gérer la même classe (mêmes élèves, sans doublon). L'invitation de collègues se fera avec la version en ligne.
      </span>
      {teachers.map((t) => (
        <label key={t.id} className="row" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={group.teacherIds.includes(t.id)}
            onChange={(e) =>
              db.groups.update(group.id, {
                teacherIds: e.target.checked ? [...group.teacherIds, t.id] : group.teacherIds.filter((x) => x !== t.id),
              })
            }
          />
          {t.name}
        </label>
      ))}
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
      <DeleteGroup group={group} />
    </div>
  );
}
