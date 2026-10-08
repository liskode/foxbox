// Trombinoscope imprimable d'une classe, tenant sur une page A4 (Imprimer › Enregistrer au format PDF).
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Student } from '../../lib/db';
import { usePhoto } from '../../components/Avatar';

function Cell({ s }: { s: Student }) {
  const url = usePhoto(s.photoId);
  return (
    <div className="tp-cell">
      {/* Photo manquante : on laisse simplement un blanc */}
      <div className={'tp-photo' + (url ? '' : ' empty')}>{url && <img src={url} alt="" />}</div>
      <div className="tp-first">{s.firstName}</div>
      <div className="tp-last">{s.lastName}</div>
    </div>
  );
}

export function TrombiPrint() {
  const { id } = useParams();
  const group = useLiveQuery(() => db.groups.get(id!), [id]);
  const students = useLiveQuery(async () => {
    const ms = await db.memberships.where('groupId').equals(id!).toArray();
    const s = (await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[];
    return s.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }, [id]);
  if (!group || !students) return null;

  // Grille calculée pour que toute la classe tienne sur une page A4 (zone utile ≈ 190 × 265 mm)
  const n = Math.max(1, students.length);
  const cols = n <= 20 ? 5 : n <= 36 ? 6 : 7;
  const rows = Math.ceil(n / cols);
  const rowH = Math.min(62, 248 / rows); // mm (marge de sécurité pour rester sur une page)
  const colW = (190 - 3 * (cols - 1)) / cols;
  const photoH = Math.min(rowH - 12, colW); // diamètre du cercle

  return (
    <div className="page stack">
      <div className="spread noprint">
        <Link to="/prof/trombi" className="small muted">
          ← Trombi
        </Link>
        <div className="row">
          <span className="small muted">Pour un PDF : Imprimer › « Enregistrer au format PDF »</span>
          <button className="btn primary" onClick={() => print()}>
            🖨 Imprimer
          </button>
        </div>
      </div>
      <div
        className="tp-sheet"
        style={{ ['--cols' as string]: cols, ['--photo-h' as string]: `${photoH}mm`, ['--row-h' as string]: `${rowH}mm` }}
      >
        <div className="tp-head">
          <img src="./logo.png" alt="" />
          <div>
            <div className="tp-title">Trombinoscope — {group.name}</div>
            <div className="tp-sub">
              {group.subject} · {group.schoolYear} · {students.length} élèves
            </div>
          </div>
        </div>
        <div className="tp-grid">
          {students.map((s) => (
            <Cell key={s.id} s={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
