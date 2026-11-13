// Classe : onglet Élèves (import CSV, photos, identifiants, objectifs, aménagements).
import { showInfo, alertBox, confirmBox } from '../../../components/Dialog';
import { useState } from 'react';
import { askForm } from '../../../components/Dialog';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, byName, groupStudents, type Group, type Rule } from '../../../lib/db';
import { parseCsv, importStudents, resetPassword, deleteStudent, rejoinGroup, type ParsedRow } from '../../../lib/students';
import { frDate } from '../../../lib/dates';
import { DEFAULT_GOAL } from '../../../lib/leitner';
import { Avatar } from '../../../components/Avatar';
import { importPhotos } from '../../../lib/photos';
import { TrombiImport } from '../../../components/TrombiImport';
import { NoteButton, FlagChecks } from '../../../components/StudentNote';
import { Icon } from '../../../components/Icon';

export function StudentsTab({ group }: { group: Group }) {
  const students = useLiveQuery(
    async () => {
      return (await groupStudents(group.id)).sort(byName);
    },
    [group.id],
    [],
  );
  // Élèves partis en cours d'année, et classe où ils sont passés
  const former = useLiveQuery(
    async () => {
      const list = group.former ?? [];
      const st = await db.students.bulkGet(list.map((f) => f.studentId));
      const to = await db.groups.bulkGet(list.map((f) => f.toGroupId ?? ''));
      return list.map((f, i) => ({ ...f, student: st[i], to: to[i] })).filter((x) => x.student).sort((a, b) => b.leftAt.localeCompare(a.leftAt));
    },
    [group.former],
    [],
  );
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [msg, setMsg] = useState('');

  async function onCsv(f?: File) {
    if (!f) return;
    const buf = await f.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf); // export Excel/ENT
    setPreview(parseCsv(text));
  }

  async function confirmImport() {
    if (!preview) return;
    setMsg('Création des comptes…');
    let r;
    try {
      r = await importStudents(preview, group.id, group.subject);
    } catch (e) {
      return setMsg('Erreur : ' + (e as Error).message);
    }
    setMsg(`${r.created} élève(s) créé(s), ${r.reused} déjà connu(s) ajouté(s) à la classe.`);
    setPreview(null);
  }

  async function onPhotos(list: FileList | null) {
    if (!list?.length) return;
    const r = await importPhotos([...list], students);
    setMsg(
      `${r.matched} photo(s) associée(s).` +
        (r.unmatched.length ? ` Non reconnue(s) : ${r.unmatched.join(', ')} — ajoutez-les à la main en cliquant sur l'avatar.` : ''),
    );
  }

  // Liste « Nom, Prénom », un élève par ligne (pour Plickers, un tableur…)
  function exportTxt() {
    const txt = students.map((s) => [s.lastName, s.firstName].filter(Boolean).join(', ')).join('\n') + '\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
    a.download = `${group.name.replace(/_.*/, '')} - liste des élèves.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function addOne() {
    const r = await askForm(`Ajouter un élève à ${group.name}`, [
      { key: 'firstName', label: 'Prénom' },
      { key: 'lastName', label: 'Nom' },
    ]);
    if (!r) return;
    try {
      await importStudents([{ firstName: r.firstName, lastName: r.lastName }], group.id, group.subject);
    } catch (e) {
      setMsg('Erreur : ' + (e as Error).message);
    }
  }

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="spread">
          <h3 style={{ margin: 0 }}>{students.length} élève(s)</h3>
          <div className="row">
            <label className="btn">
              Importer un CSV
              <input type="file" accept=".csv,.txt" hidden onChange={(e) => onCsv(e.target.files?.[0])} />
            </label>
            <button className="btn" onClick={() => setPdfOpen(true)}>
              <Icon name="file" size={16} /> Trombinoscope PDF
            </button>
            <button className="btn" onClick={exportTxt} disabled={!students.length} title="Nom, Prénom : un élève par ligne (pour Plickers par exemple)">
              <Icon name="file" size={16} /> Liste (.txt)
            </button>
            <label className="btn">
              <Icon name="camera" size={16} /> Photos (fichiers)
              <input type="file" accept="image/*" multiple hidden onChange={(e) => onPhotos(e.target.files)} />
            </label>
            <button className="btn ghost" onClick={addOne}>
              + Élève
            </button>
            <Link className="btn primary" to={`/prof/classes/${group.id}/fiches`}>
              <Icon name="print" size={16} /> Fiches identifiants
            </Link>
          </div>
        </div>
        <span className="small muted">
          CSV accepté : colonnes « Nom ; Prénom » (avec ou sans en-tête), ou export ENT/Pronote avec une colonne « Élève ». Un élève déjà connu de
          FoxBox est réutilisé (pas de doublon, il garde ses flashcards).
          <br />
          Photos : sélectionnez plusieurs fichiers nommés avec le nom et le prénom (ex. « DUPONT Marie.jpg », « marie.dupont.png ») ; ils sont
          associés automatiquement. Un clic sur l'avatar change une photo.
        </span>
        {msg && <div className="notice">{msg}</div>}
        {pdfOpen && <TrombiImport group={group} students={students} onClose={() => setPdfOpen(false)} />}
        {preview && (
          <div className="notice stack">
            <b>{preview.length} élève(s) trouvé(s) dans le fichier :</b>
            <div className="small">
              {preview
                .slice(0, 12)
                .map((r) => `${r.firstName} ${r.lastName}`)
                .join(' · ')}
              {preview.length > 12 && ' …'}
            </div>
            <div className="row">
              <button className="btn primary" onClick={confirmImport}>
                Importer dans {group.name}
              </button>
              <button className="btn ghost" onClick={() => setPreview(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="list">
          <thead>
            <tr>
              <th>Élève</th>
              <th>Identifiant · mot de passe</th>
              <th title="Objectif de flashcards par jour et règle en cas d'erreur">Révisions</th>
              <th>Aménagements</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                    <Avatar student={s} size={40} editable zoom />
                    <Link to={`/prof/eleves/${s.id}?classe=${group.id}`} style={{ lineHeight: 1.15, minWidth: 150 }}>
                      <b>{s.lastName}</b>
                      <br />
                      {s.firstName}
                    </Link>
                    {!s.firstName && (
                      <Link to={`/prof/eleves/${s.id}?classe=${group.id}`} className="chip" style={{ background: '#f6c9c3', textDecoration: 'none' }}>
                        prénom à compléter
                      </Link>
                    )}
                  </span>
                </td>
                <td style={{ maxWidth: 230 }}>
                  <div className="code" title={s.login} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {s.login}
                  </div>
                  <div className="code">{s.password}</div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    style={{ width: 62 }}
                    title="Objectif de flashcards par jour"
                    value={s.goals[group.subject] ?? DEFAULT_GOAL}
                    onChange={(e) => db.students.update(s.id, { goals: { ...s.goals, [group.subject]: Math.max(1, Number(e.target.value)) } })}
                  />{' '}
                  <select
                    value={s.rule}
                    title="Règle d'erreur : stricte = retour en boîte 1 ; douce = une boîte en arrière"
                    onChange={(e) => db.students.update(s.id, { rule: e.target.value as Rule })}
                  >
                    <option value="strict">Stricte</option>
                    <option value="douce">Douce</option>
                  </select>
                </td>
                <td>
                  <FlagChecks studentId={s.id} compact />
                </td>
                <td>
                  <NoteButton student={s} />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn small ghost"
                    title="Nouveau mot de passe"
                    onClick={async () => {
                      if (!(await confirmBox(`Nouveau mot de passe pour ${s.firstName} ?`))) return;
                      try {
                        await resetPassword(s.id);
                        const s2 = await db.students.get(s.id);
                        await showInfo(`Nouveau mot de passe de ${s.firstName} ${s.lastName}`, `Identifiant : ${s.login}\nMot de passe : ${s2?.password ?? '?'}`);
                      } catch (e) {
                        alertBox((e as Error).message);
                      }
                    }}
                  >
                    <Icon name="key" size={16} />
                  </button>{' '}
                  <button
                    className="btn small danger"
                    title="Supprimer définitivement l'élève"
                    onClick={async () =>
                      (await confirmBox(
                        `Supprimer définitivement ${s.firstName} ${s.lastName} ?\n\nSon compte, sa photo, sa progression et son historique seront effacés, dans toutes ses classes. Cette action est irréversible.`,
                      )) && deleteStudent(s.id).catch((e) => alertBox(e.message))
                    }
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {former.length > 0 && (
        <div className="panel calm stack" style={{ gap: 8 }}>
          <h3 className="panel-title">Partis en cours d'année ({former.length})</h3>
          {former.map((f) => (
            <div key={f.studentId} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <Avatar student={f.student!} size={32} />
              <Link to={`/prof/eleves/${f.studentId}`} style={{ minWidth: 150 }}>
                <b>{f.student!.lastName}</b> {f.student!.firstName}
              </Link>
              <span className="small muted" style={{ flex: 1 }}>
                le {frDate(f.leftAt)} · {f.to ? `passé(e) en ${f.to.name}` : "a quitté l'établissement"}
              </span>
              <button className="btn small ghost" onClick={() => rejoinGroup(group, f.studentId)} title="Remettre dans la classe">
                Réintégrer
              </button>
            </div>
          ))}
          <span className="small muted">
            Ils n'apparaissent plus dans les listes, l'appel ni les nouvelles évaluations de la classe ; leur fiche (notes, absences, flashcards) reste
            consultable. Pour effacer définitivement un élève, utilisez le bouton de suppression de sa fiche.
          </span>
        </div>
      )}
    </div>
  );
}
