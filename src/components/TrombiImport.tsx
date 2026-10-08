// Import des photos depuis un trombinoscope PDF : aperçu, association vérifiable, puis enregistrement.
import { useState } from 'react';
import type { Group, Student } from '../lib/db';
import { readTrombiPdf, matchFace, type Face } from '../lib/trombiPdf';
import { setPhoto } from '../lib/photos';
import { importStudents } from '../lib/students';
import { db } from '../lib/db';
import { isStaleVersionError } from './UpdateBanner';

const CREATE = '__create__';
const SKIP = '';

export function TrombiImport({ group, students, onClose }: { group: Group; students: Student[]; onClose: () => void }) {
  const [faces, setFaces] = useState<Face[] | null>(null);
  const [choice, setChoice] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function onFile(f?: File) {
    if (!f) return;
    setErr('');
    try {
      const fs = await readTrombiPdf(f, setBusy);
      if (!fs.length) throw new Error('Aucune photo trouvée dans ce PDF.');
      setFaces(fs);
      setChoice(fs.map((x) => matchFace(x.caption, students) ?? (students.length ? SKIP : CREATE)));
    } catch (e) {
      setErr(
        isStaleVersionError(e)
          ? 'STALE'
          : (e as Error).message,
      );
    } finally {
      setBusy('');
    }
  }

  const used = new Map<string, number>();
  choice.forEach((c) => c && c !== CREATE && used.set(c, (used.get(c) ?? 0) + 1));
  const toSave = choice.filter((c) => c && c !== CREATE).length;
  const toCreate = choice.filter((c) => c === CREATE).length;
  const duplicates = [...used.values()].some((n) => n > 1);

  async function save() {
    if (!faces) return;
    setBusy('Enregistrement…');
    try {
      // 1. Création des élèves absents de la classe
      const create = faces.filter((_, i) => choice[i] === CREATE);
      let list = students;
      if (create.length) {
        setBusy(`Création de ${create.length} compte(s) élève…`);
        await importStudents(
          create.map((f) => ({ firstName: f.firstName, lastName: f.lastName })),
          group.id,
          group.subject,
        );
        const ms = await db.memberships.where('groupId').equals(group.id).toArray();
        list = (await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[];
      }
      // 2. Photos
      let n = 0;
      for (let i = 0; i < faces.length; i++) {
        let id = choice[i];
        if (id === CREATE) id = matchFace(`${faces[i].lastName} ${faces[i].firstName}`, list) ?? '';
        if (!id) continue;
        setBusy(`Photos : ${++n}/${toSave + toCreate}`);
        await setPhoto(id, faces[i].blob, `${faces[i].caption}.jpg`);
      }
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy('');
    }
  }

  return (
    <div className="notice stack" style={{ background: 'var(--paper)' }}>
      <div className="spread">
        <b>Importer les photos d'un trombinoscope PDF (export ENT)</b>
        <button className="btn small ghost" onClick={onClose}>
          Fermer
        </button>
      </div>
      {!faces && (
        <>
          <span className="small">
            Importez d'abord la liste des élèves (CSV) : les photos leur sont ensuite associées d'après le nom écrit sous
            chacune, même s'il est coupé (« CARDOSO GARCI… »). Vous vérifiez avant d'enregistrer.
          </span>
          <label className="btn primary" style={{ alignSelf: 'flex-start' }}>
            Choisir le PDF
            <input type="file" accept="application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </>
      )}
      {busy && <div>{busy}</div>}
      {err === 'STALE' ? (
        <div style={{ fontWeight: 700 }}>
          FoxBox a été mis à jour depuis l'ouverture de cette page.{' '}
          <button className="btn small primary" onClick={() => location.reload()}>
            Recharger la page
          </button>{' '}
          puis relancez l'import du PDF.
        </div>
      ) : (
        err && <div style={{ color: 'var(--forgot)', fontWeight: 700 }}>{err}</div>
      )}
      {faces && (
        <>
          <div className="small">
            {faces.length} photo(s) trouvée(s) · {choice.filter((c) => c && c !== CREATE).length} associée(s)
            {toCreate > 0 && ` · ${toCreate} élève(s) à créer`}
            {choice.filter((c) => c === SKIP).length > 0 && ` · ${choice.filter((c) => c === SKIP).length} ignorée(s)`}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {faces.map((f, i) => {
              const c = choice[i];
              const dup = c && c !== CREATE && (used.get(c) ?? 0) > 1;
              return (
                <div key={i} className="stack" style={{ gap: 4, padding: 6, borderRadius: 12, border: `2px solid ${dup ? 'var(--forgot)' : c ? 'var(--easy)' : 'var(--muted-line)'}` }}>
                  <img src={f.thumb} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
                  <div className="small" style={{ fontWeight: 700, lineHeight: 1.2 }}>{f.caption || '(pas de nom)'}</div>
                  <select
                    value={c}
                    onChange={(e) => setChoice(choice.map((x, j) => (j === i ? e.target.value : x)))}
                    style={{ fontSize: '0.8rem', padding: 4 }}
                  >
                    <option value={SKIP}>— ignorer —</option>
                    {students
                      .slice()
                      .sort((a, b) => a.lastName.localeCompare(b.lastName))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.lastName} {s.firstName}
                        </option>
                      ))}
                    <option value={CREATE}>
                      + Créer « {f.firstName} {f.lastName} »{f.truncated ? ' (nom coupé !)' : ''}
                    </option>
                  </select>
                  {dup && <span className="small" style={{ color: 'var(--forgot)' }}>Élève choisi deux fois</span>}
                </div>
              );
            })}
          </div>
          <div className="row">
            <button className="btn primary" disabled={!!busy || duplicates || !(toSave + toCreate)} onClick={save}>
              Enregistrer {toSave + toCreate} photo(s)
            </button>
            <button className="btn ghost" onClick={onClose}>
              Annuler
            </button>
          </div>
        </>
      )}
    </div>
  );
}
