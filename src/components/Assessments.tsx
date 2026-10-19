// Évaluations de l'élève dans son établissement (DS, contrôles) : signalées à l'avance par l'élève, un parent ou
// le professeur (date, matière, programme), puis complétées (copie, corrigé, note). Graphique de progression par matière.
// Partagé par l'espace élève, l'espace parents et le suivi du professeur.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, fileBlob, uid, type Assessment, type AssessmentDocKind, type Unit } from '../lib/db';
import { byProgression, unitLabel, unitSubject } from '../lib/units';
import { frDate, today } from '../lib/dates';
import { dayName } from './Soutien';
import { openDocument } from './UnitDetails';
import { RichText } from './CardFace';
import { toast } from './Toast';
import { Icon } from './Icon';

const KINDS: { key: AssessmentDocKind; label: string }[] = [
  { key: 'programme', label: 'Programme (capture Pronote…)' },
  { key: 'sujet', label: 'Sujet' },
  { key: 'copie', label: 'Copie' },
  { key: 'corrige', label: 'Corrigé' },
  { key: 'autre', label: 'Autre' },
];
const COMMON = ['Mathématiques', 'Physique-Chimie', 'Génie mécanique', 'Français', 'Anglais', 'Histoire-Géographie'];
const on20 = (a: Assessment) => (a.score !== undefined ? (a.score / (a.outOf || 20)) * 20 : undefined);
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

// Matières et points du programme proposés : ceux des suivis de soutien de l'élève
function useContext(studentId: string) {
  return useLiveQuery(
    async () => {
      const ms = await db.memberships.where('studentId').equals(studentId).toArray();
      const groups = (await db.groups.bulkGet(ms.map((m) => m.groupId))).filter((g) => g && !g.archived);
      const tracks = groups.flatMap((g) => (g!.kind === 'soutien' ? (g!.tracks ?? []) : [{ subject: g!.subject, level: '' }]));
      const all = await db.units.toArray();
      const units = all
        .filter((u) => tracks.some((t) => unitSubject(u) === t.subject && (!t.level || u.level === t.level)))
        .sort((a, b) => (a.kind === b.kind ? byProgression(a, b) : 0));
      return { subjects: [...new Set([...tracks.map((t) => t.subject), ...COMMON])], units, all };
    },
    [studentId],
    { subjects: COMMON, units: [] as Unit[], all: [] as Unit[] },
  );
}

export function AssessmentsPanel({
  studentId,
  meId,
  canGrade,
  startOpen = false,
  firstName,
  hideTitle = false,
}: {
  studentId: string;
  meId: string;
  canGrade: boolean; // saisir la note (élève, professeur)
  startOpen?: boolean; // ouvre directement le formulaire « Signaler un DS à venir »
  firstName?: string;
  hideTitle?: boolean; // la page porte déjà le titre « Évaluations »
}) {
  const list = useLiveQuery(async () => (await db.assessments.where('studentId').equals(studentId).toArray()).sort((a, b) => a.date.localeCompare(b.date)), [studentId], []);
  const ctx = useContext(studentId);
  const [edit, setEdit] = useState<Assessment | null>(() => (startOpen ? blank(studentId, meId) : null));
  const upcoming = list.filter((a) => a.date >= today());
  const past = list.filter((a) => a.date < today()).reverse();
  return (
    <div className="stack">
      <div className="spread">
        {hideTitle ? <span /> : <h2 style={{ margin: 0 }}>Évaluations{firstName ? ` de ${firstName}` : ''}</h2>}
        {!edit && (
          <button className="btn primary" onClick={() => setEdit(blank(studentId, meId))}>
            <Icon name="alert" /> Signaler un DS à venir
          </button>
        )}
      </div>
      {edit && <AssessmentForm a={edit} ctx={ctx} canGrade={canGrade} onClose={() => setEdit(null)} />}
      <ProgressChart list={list} />
      <h3 className="panel-title">À venir</h3>
      {!upcoming.length && <span className="small muted">Aucune évaluation annoncée.</span>}
      {upcoming.map((a) => (
        <AssessmentCard key={a.id} a={a} units={ctx.all} onEdit={() => setEdit(a)} />
      ))}
      <h3 className="panel-title">Passées</h3>
      {!past.length && <span className="small muted">Rien pour l'instant.</span>}
      {past.map((a) => (
        <AssessmentCard key={a.id} a={a} units={ctx.all} onEdit={() => setEdit(a)} />
      ))}
    </div>
  );
}

const blank = (studentId: string, meId: string): Assessment => ({
  id: uid(),
  studentId,
  authorId: meId,
  date: '',
  subject: '',
  title: '',
  unitIds: [],
  program: '',
  documents: [],
  outOf: 20,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

function AssessmentCard({ a, units, onEdit }: { a: Assessment; units: Unit[]; onEdit: () => void }) {
  const points = a.unitIds.map((id) => units.find((u) => u.id === id)).filter(Boolean) as Unit[];
  const n = on20(a);
  return (
    <div className="panel stack" style={{ gap: 6 }}>
      <div className="spread">
        <b>
          {dayName(a.date)} {frDate(a.date)} · {a.subject || 'Matière ?'} {a.title && `· ${a.title}`}
        </b>
        <span className="row" style={{ gap: 6 }}>
          {a.score !== undefined && (
            <span className={'tag ' + (n! >= 10 ? 'ok' : n! >= 8 ? 'warn' : 'bad')}>
              {fmt(a.score)} / {a.outOf || 20}
            </span>
          )}
          <button className="btn small ghost" onClick={onEdit}>
            <Icon name="edit" size={14} /> Compléter
          </button>
        </span>
      </div>
      {points.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          {points.map((u) => (
            <span key={u.id} className="tag plain" style={{ whiteSpace: 'normal' }}>
              {unitLabel(u)}
            </span>
          ))}
        </div>
      )}
      {a.program.trim() && <RichText text={a.program} />}
      {a.documents.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          {a.documents.map((d) => (
            <button key={d.mediaId} className="btn small" onClick={() => openDocument(d.mediaId, d.name)}>
              <Icon name={d.type.startsWith('image/') ? 'camera' : 'file'} size={14} /> {KINDS.find((k) => k.key === d.kind)?.label.split(' (')[0]} · {d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssessmentForm({
  a,
  ctx,
  canGrade,
  onClose,
}: {
  a: Assessment;
  ctx: { subjects: string[]; units: Unit[] };
  canGrade: boolean;
  onClose: () => void;
}) {
  const [v, setV] = useState<Assessment>(a);
  const [kind, setKind] = useState<AssessmentDocKind>(!a.date || a.date > today() ? 'programme' : 'copie');
  const [busy, setBusy] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const exists = useLiveQuery(() => db.assessments.get(a.id), [a.id]);
  const set = (p: Partial<Assessment>) => setV({ ...v, ...p });
  const seqs = ctx.units.filter((u) => u.kind === 'sequence');

  async function save() {
    if (!v.date || !v.subject.trim()) return toast('Indique au moins la date et la matière', { error: true });
    await db.assessments.put({ ...v, subject: v.subject.trim(), title: v.title.trim(), updatedAt: Date.now() });
    toast(exists ? 'Évaluation mise à jour' : 'Évaluation signalée');
    onClose();
  }
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const docs = [...v.documents];
    for (const f of [...files]) {
      // Rangé avec les messages « à tous » de l'élève : lisible par l'élève, ses parents et ses professeurs
      const mediaId = `msg/${v.studentId}/tous/${uid()}`;
      await db.media.put({ id: mediaId, name: f.name || 'photo.jpg', blob: await fileBlob(f) });
      docs.push({ mediaId, name: f.name || 'photo.jpg', size: f.size, type: f.type, kind });
    }
    set({ documents: docs });
    setBusy(false);
  }
  return (
    <div className="panel stack" style={{ gap: 10, borderColor: 'var(--matiere)', borderWidth: 2 }}>
      <h3 className="panel-title">{exists ? 'Compléter l’évaluation' : 'Signaler un DS à venir'}</h3>
      <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
        <label className="field">
          Date
          <input type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 160 }}>
          Matière
          <input list="assess-subjects" value={v.subject} placeholder="Mathématiques…" onChange={(e) => set({ subject: e.target.value })} />
          <datalist id="assess-subjects">
            {ctx.subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field" style={{ flex: 2, minWidth: 180 }}>
          Titre
          <input value={v.title} placeholder="DS, contrôle, interro…" onChange={(e) => set({ title: e.target.value })} />
        </label>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <b className="small">Programme</b>
        {v.unitIds.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            {v.unitIds.map((id) => {
              const u = ctx.units.find((x) => x.id === id);
              return (
                <span key={id} className="tag plain">
                  {u ? unitLabel(u) : 'point retiré'}
                  <button className="btn small ghost" style={{ border: 'none', padding: 0 }} onClick={() => set({ unitIds: v.unitIds.filter((x) => x !== id) })}>
                    <Icon name="x" size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {ctx.units.length > 0 && (
          <div>
            <button className="btn small" onClick={() => setShowUnits(!showUnits)}>
              {showUnits ? 'Fermer' : 'Choisir dans les points du programme'}
            </button>
          </div>
        )}
        {showUnits && (
          <div className="stack" style={{ gap: 0, maxHeight: 260, overflowY: 'auto' }}>
            {seqs.map((q) => (
              <div key={q.id}>
                {[q, ...ctx.units.filter((u) => u.parentId === q.id).sort((x, y) => x.order - y.order)].map((u) => (
                  <label key={u.id} className="prog-item small" style={{ paddingLeft: u.kind === 'seance' ? 28 : 8, fontWeight: u.kind === 'sequence' ? 800 : 500 }}>
                    <input
                      type="checkbox"
                      checked={v.unitIds.includes(u.id)}
                      onChange={(e) => set({ unitIds: e.target.checked ? [...v.unitIds, u.id] : v.unitIds.filter((x) => x !== u.id) })}
                    />{' '}
                    <span className="name">{unitLabel(u)}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
        <textarea
          aria-label="Programme en texte libre"
          placeholder="Ou en texte libre : chapitres, exercices à revoir…"
          value={v.program}
          onChange={(e) => set({ program: e.target.value })}
          style={{ fontFamily: 'var(--font)', fontSize: '0.95rem', minHeight: 60 }}
        />
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <b className="small">Documents</b>
        <div className="row" style={{ gap: 8 }}>
          <select value={kind} onChange={(e) => setKind(e.target.value as AssessmentDocKind)} aria-label="Type de document">
            {KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
          <label className="btn small">
            <Icon name="camera" size={15} /> {busy ? 'Ajout…' : 'Photo / fichier'}
            <input type="file" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
          </label>
        </div>
        {v.documents.map((d, i) => (
          <span key={d.mediaId} className="row small" style={{ gap: 6 }}>
            <Icon name="file" size={14} /> {KINDS.find((k) => k.key === d.kind)?.label.split(' (')[0]} · {d.name}
            <button className="btn small ghost" style={{ border: 'none' }} title="Retirer" onClick={() => set({ documents: v.documents.filter((_, j) => j !== i) })}>
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
      </div>
      {canGrade && !!v.date && v.date <= today() && (
        <div className="row" style={{ gap: 8 }}>
          <b className="small">Note</b>
          <input
            inputMode="decimal"
            style={{ width: 70 }}
            value={v.score === undefined ? '' : fmt(v.score)}
            placeholder="—"
            onChange={(e) => {
              const n = Number(e.target.value.replace(',', '.'));
              set({ score: e.target.value.trim() === '' || Number.isNaN(n) ? undefined : n });
            }}
          />
          <span>sur</span>
          <input inputMode="decimal" style={{ width: 60 }} value={v.outOf ?? 20} onChange={(e) => set({ outOf: Number(e.target.value.replace(',', '.')) || 20 })} />
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary" onClick={save}>
          Enregistrer
        </button>
        <button className="btn ghost" onClick={onClose}>
          Annuler
        </button>
        {exists && (
          <button
            className="btn ghost"
            style={{ marginLeft: 'auto' }}
            onClick={async () => {
              await db.assessments.delete(a.id);
              toast('Évaluation supprimée', { undo: () => db.assessments.put(a) });
              onClose();
            }}
          >
            <Icon name="trash" size={14} /> Supprimer
          </button>
        )}
      </div>
    </div>
  );
}

// Progression : notes ramenées sur 20, une courbe par matière
const COLORS = ['#1d5fa8', '#e05a4f', '#16a34a', '#f59e0b', '#9333ea', '#0891b2'];
export function ProgressChart({ list }: { list: Assessment[] }) {
  const pts = list.filter((a) => a.score !== undefined).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 1) return null;
  const subjects = [...new Set(pts.map((a) => a.subject))];
  const W = 520;
  const H = 180;
  const L = 30;
  const dates = pts.map((a) => new Date(a.date).getTime());
  const t0 = Math.min(...dates);
  const t1 = Math.max(...dates);
  const x = (d: string) => (t1 === t0 ? (L + W) / 2 : L + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - L - 10));
  const y = (n: number) => 10 + (1 - n / 20) * (H - 30);
  return (
    <div className="panel stack" style={{ gap: 6 }}>
      <h3 className="panel-title">
        <Icon name="chart" size={16} /> Ma progression (notes sur 20)
      </h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {[0, 5, 10, 15, 20].map((g) => (
          <g key={g}>
            <line x1={L} x2={W} y1={y(g)} y2={y(g)} stroke={g === 10 ? '#bbb' : '#eee'} />
            <text x={4} y={y(g) + 4} fontSize="10" fill="#888">
              {g}
            </text>
          </g>
        ))}
        {subjects.map((s, i) => {
          const ps = pts.filter((a) => a.subject === s);
          const c = COLORS[i % COLORS.length];
          return (
            <g key={s}>
              <polyline fill="none" stroke={c} strokeWidth="2.5" points={ps.map((a) => `${x(a.date)},${y(on20(a)!)}`).join(' ')} />
              {ps.map((a) => (
                <circle key={a.id} cx={x(a.date)} cy={y(on20(a)!)} r="4" fill={c}>
                  <title>{`${frDate(a.date)} · ${s} : ${fmt(on20(a)!)} / 20`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="row small" style={{ gap: 12 }}>
        {subjects.map((s, i) => (
          <span key={s} className="row" style={{ gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % COLORS.length] }} /> {s}
          </span>
        ))}
      </div>
    </div>
  );
}
