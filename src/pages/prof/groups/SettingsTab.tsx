// Classe : onglet Réglages (co-enseignants, archivage, suppression).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Group } from '../../../lib/db';
import { deleteGroup } from '../../../lib/students';
import { levelOfName } from '../../../lib/units';

export function DeleteGroup({ group }: { group: Group }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [orphans, setOrphans] = useState(true);
  const [busy, setBusy] = useState('');
  async function go() {
    if (!confirm(`Supprimer définitivement la classe « ${group.name} » ?`)) return;
    setBusy('Suppression…');
    try {
      const n = await deleteGroup(group.id, orphans);
      alert(`Classe supprimée${n ? `, ainsi que ${n} élève(s)` : ''}.`);
      nav('/prof/reglages');
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
  return (
    <div className="panel stack">
      <div className="small">
        Couleur : celle du niveau{' '}
        <span className="chip" style={{ background: group.color ?? 'var(--paper)' }}>
          {levelOfName(group.name) ?? 'niveau inconnu'}
        </span>{' '}
        — modifiable dans <Link to="/prof/reglages">Réglages › Couleurs des niveaux</Link>.
      </div>
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
          onClick={() =>
            confirm(group.archived ? 'Réactiver cette classe ?' : 'Archiver cette classe ? Les élèves gardent leurs comptes et leurs flashcards.') &&
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
