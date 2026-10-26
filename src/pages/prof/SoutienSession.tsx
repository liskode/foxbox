// Soutien scolaire : fiche d'une séance (quand, programme travaillé, contenu de la séance, travail, notes, documents, liens, flashcards).
// Tout est enregistré au fil de la saisie (en quittant un champ).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type Group, type SessionNoteKind, type Student, type TutoringSession, type Unit } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { deleteSession, durationLabel, syncPublications, trackLabel } from '../../lib/tutoring';
import { byProgression, unitLabel, unitSubject } from '../../lib/units';
import { themesOf } from '../../lib/themes';
import { cardCode, defaultOrigin } from '../../lib/cardCodes';
import { FileList, HomeworkTag, UploadButton, dayName, whenLabel } from '../../components/Soutien';
import { CardBrowser } from '../../components/CardBrowser';
import { CardDetail } from '../../components/CardDetail';
import { CardFace, RichText } from '../../components/CardFace';
import { themeColor } from '../../components/widgets';
import { frDate } from '../../lib/dates';
import { toast } from '../../components/Toast';
import { LineTag } from '../../components/Billing';
import { markFilesSeen } from '../../components/TutoringTile';
import { money, loadLedger } from '../../lib/billing';
import { Icon } from '../../components/Icon';
import { TimeInput } from '../../components/TimeInput';

const DURATIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180];
const FORMULA_HINT = 'Formules entre $ … $ (ex. $\\frac{1}{2}mv^2$), gras entre ** … **';

export function SoutienSession() {
  const { id, sid } = useParams();
  const group = useLiveQuery(async () => (await db.groups.get(id!)) ?? null, [id]);
  const s = useLiveQuery(async () => (await db.tutoringSessions.get(sid!)) ?? null, [sid]);
  const students = useLiveQuery(
    async () => {
      const ms = await db.memberships.where('groupId').equals(id!).toArray();
      return ((await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[]).sort((a, b) => a.firstName.localeCompare(b.firstName));
    },
    [id],
    [],
  );
  const nav = useNavigate();
  if (group === undefined || s === undefined) return null;
  if (!group || !s) return <div className="page muted">Séance introuvable.</div>;
  const set = (patch: Partial<TutoringSession>) => db.tutoringSessions.update(s.id, patch);
  const present = students.filter((x) => s.studentIds.includes(x.id));

  return (
    <div className="page stack" style={{ maxWidth: 900 }}>
      <div>
        <Link to={`/prof/soutien/${group.id}`} className="small muted">
          ← {group.name}
        </Link>
        <h1 className="title" style={{ margin: 0 }}>
          Séance
        </h1>
        <b>{whenLabel(s, group.timezone)}</b>
      </div>

      <div className="panel stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <label className="field">
            Date
            <input type="date" value={s.date} onChange={(e) => e.target.value && set({ date: e.target.value }).then(() => syncPublications(group.id))} />
          </label>
          <label className="field">
            Heure
            <TimeInput value={s.start} step={300} onChange={(v) => set({ start: v || undefined })} />
          </label>
          <label className="field">
            Durée
            <select value={s.duration} onChange={(e) => set({ duration: Number(e.target.value) })}>
              {[...new Set([...DURATIONS, s.duration])]
                .sort((a, b) => a - b)
                .map((d) => (
                  <option key={d} value={d}>
                    {durationLabel(d)}
                  </option>
                ))}
            </select>
          </label>
          <div className="field">
            <span>Lieu</span>
            <div className="seg">
              {(['domicile', 'en ligne'] as const).map((p) => (
                <button key={p} className={s.place === p ? 'on' : ''} onClick={() => set({ place: p })}>
                  <Icon name={p === 'domicile' ? 'home' : 'laptop'} size={14} /> {p === 'domicile' ? 'À domicile' : 'En ligne'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <SessionAmounts s={s} students={present} groupId={group.id} />
        {students.length > 1 && (
          <div className="row" style={{ gap: 12 }}>
            <b className="small">Présents :</b>
            {students.map((x) => (
              <label key={x.id} className="row small" style={{ gap: 4, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={s.studentIds.includes(x.id)}
                  onChange={(e) => set({ studentIds: e.target.checked ? [...s.studentIds, x.id] : s.studentIds.filter((i) => i !== x.id) })}
                />
                {x.firstName}
              </label>
            ))}
          </div>
        )}
      </div>

      <ProgrammePicker group={group} s={s} />

      <TextPanel
        title="Contenu de la séance"
        icon="check"
        value={s.done}
        placeholder="Ce qui est prévu (à préparer, à apporter), puis ce qui a été fait : notions, exercices, difficultés…"
        onSave={(done) => set({ done })}
      />

      <div className="panel stack" style={{ gap: 8 }}>
        <TextBlock
          title="Travail pour la prochaine fois"
          icon="clipboard"
          value={s.homework}
          placeholder="Exercices, leçon à revoir, flashcards…"
          onSave={(homework) => set({ homework })}
        />
        {s.homework.trim() && <HomeworkStatus s={s} students={present} />}
      </div>

      {present.map((x) => (
        <NotesPanel key={x.id} s={s} student={x} showName={students.length > 1} />
      ))}

      <DocumentsPanel s={s} />
      <LinksPanel s={s} />
      <CardsPanel group={group} s={s} />

      <div>
        <button
          className="btn ghost"
          onClick={async () => {
            const undo = await deleteSession(s);
            nav(`/prof/soutien/${group.id}`, { replace: true });
            toast('Séance supprimée', { undo });
          }}
        >
          <Icon name="trash" size={15} /> Supprimer la séance
        </button>
      </div>
    </div>
  );
}

// Montant de la séance pour chaque élève présent (tarif en vigueur à la date) et état du règlement
function SessionAmounts({ s, students, groupId }: { s: TutoringSession; students: Student[]; groupId: string }) {
  const { session } = useAuth();
  const rows = useLiveQuery(
    () =>
      Promise.all(
        students.map(async (st) => {
          const { ledger } = await loadLedger(session!.id, st.id);
          return { st, currency: ledger.currency, line: ledger.lines.find((l) => l.session.id === s.id) };
        }),
      ),
    [students, s.id, s.date, s.duration, session?.id],
    [],
  );
  // Soutien gratuit (tarif à 0) ou séance à venir : rien à afficher
  if (!rows.length || rows.every((r) => !r.line || r.line.rate === 0)) return null;
  return (
    <div className="row small" style={{ gap: 12 }}>
      {rows.map(({ st, line, currency }) => (
        <span key={st.id} className="row" style={{ gap: 6 }}>
          {students.length > 1 && <b>{st.firstName} :</b>}
          {line?.amount ? <b>{money(line.amount, currency)}</b> : null}
          {line && <LineTag l={line} />}
        </span>
      ))}
      <Link to={`/prof/soutien/${groupId}?onglet=reglements`} className="small muted">
        Règlements
      </Link>
    </div>
  );
}

// Zone de texte enregistrée en quittant le champ, avec aperçu des formules
function TextBlock({ title, icon, value, placeholder, onSave, hint }: { title: string; icon: string; value: string; placeholder: string; onSave: (v: string) => unknown; hint?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <>
      <h3 className="panel-title">
        <Icon name={icon} size={16} /> {title}
      </h3>
      <textarea
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onSave(v)}
        style={{ fontFamily: 'var(--font)', fontSize: '0.95rem', minHeight: 90 }}
      />
      {/\$/.test(v) && (
        <div className="panel calm" style={{ padding: '8px 12px' }}>
          <RichText text={v} />
        </div>
      )}
      <span className="small muted">{hint ?? FORMULA_HINT}</span>
    </>
  );
}
function TextPanel(props: Parameters<typeof TextBlock>[0]) {
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <TextBlock {...props} />
    </div>
  );
}

function HomeworkStatus({ s, students }: { s: TutoringSession; students: Student[] }) {
  const checks = useLiveQuery(() => db.homeworkChecks.where('sessionId').equals(s.id).toArray(), [s.id], []);
  return (
    <div className="row" style={{ gap: 8 }}>
      {students.map((x) => {
        const c = checks.find((k) => k.studentId === x.id);
        return <HomeworkTag key={x.id} check={c} who={students.length > 1 ? x.firstName : `Réponse de ${x.firstName}`} />;
      })}
    </div>
  );
}

const NOTE_KINDS: { kind: SessionNoteKind; title: string; who: string; cls: string }[] = [
  { kind: 'eleve', title: "Pour l'élève", who: "Lue par l'élève, pas par ses parents", cls: 'panel' },
  { kind: 'parents', title: 'Pour les parents', who: "Lue par les parents (quand leur accès sera ouvert), pas par l'élève", cls: 'panel' },
  { kind: 'prive', title: 'Note privée', who: 'Visible par vous seul', cls: 'panel note' },
];

function NotesPanel({ s, student, showName }: { s: TutoringSession; student: Student; showName: boolean }) {
  const { session } = useAuth();
  const notes = useLiveQuery(() => db.sessionNotes.where('sessionId').equals(s.id).filter((n) => n.studentId === student.id).toArray(), [s.id, student.id], []);
  async function save(kind: SessionNoteKind, text: string) {
    const nid = `${s.id}|${student.id}|${kind}`;
    if (!text.trim()) return db.sessionNotes.delete(nid);
    await db.sessionNotes.put({ id: nid, sessionId: s.id, groupId: s.groupId, teacherId: session!.id, studentId: student.id, kind, text, updatedAt: Date.now() });
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      {showName && <h3 style={{ margin: 0 }}>Notes – {student.firstName}</h3>}
      <div className="grid3">
        {NOTE_KINDS.map((k) => (
          <div key={k.kind} className={k.cls + ' stack'} style={{ gap: 6 }}>
            <NoteField title={k.title} who={k.who} value={notes.find((n) => n.kind === k.kind)?.text ?? ''} onSave={(t) => save(k.kind, t)} />
          </div>
        ))}
      </div>
    </div>
  );
}
function NoteField({ title, who, value, onSave }: { title: string; who: string; value: string; onSave: (v: string) => unknown }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <>
      <b className="small">{title}</b>
      <textarea aria-label={title} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} style={{ fontFamily: 'var(--font)', fontSize: '0.9rem', minHeight: 80, background: 'transparent' }} />
      <span className="small muted">
        <Icon name="lock" size={12} /> {who}
      </span>
    </>
  );
}

function DocumentsPanel({ s }: { s: TutoringSession }) {
  const { session } = useAuth();
  useEffect(() => {
    markFilesSeen(session!.id, s.groupId);
  }, [session, s.groupId]);
  const files = useLiveQuery(() => db.tutoringFiles.where('sessionId').equals(s.id).sortBy('createdAt'), [s.id], []);
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <div className="spread">
        <h3 className="panel-title">
          <Icon name="file" size={16} /> Documents
        </h3>
        <UploadButton groupId={s.groupId} sessionId={s.id} authorId={session!.id} byStudent={false} />
      </div>
      {files.length ? <FileList files={files} canDelete={() => true} /> : <span className="small muted">Énoncés, corrigés, photos du tableau… L'élève les retrouve dans son espace.</span>}
      {files.some((f) => f.byStudent) && <span className="small muted">Certains documents ont été déposés par l'élève.</span>}
    </div>
  );
}

function LinksPanel({ s }: { s: TutoringSession }) {
  const [draft, setDraft] = useState<{ url: string; label: string } | null>(null);
  const set = (links: TutoringSession['links']) => db.tutoringSessions.update(s.id, { links });
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <div className="spread">
        <h3 className="panel-title">
          <Icon name="link" size={16} /> Liens
        </h3>
        {!draft && (
          <button className="btn small" onClick={() => setDraft({ url: '', label: '' })}>
            <Icon name="plus" size={15} /> Ajouter un lien
          </button>
        )}
      </div>
      {s.links.map((l, i) => (
        <div key={i} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <Icon name="link" size={15} />
          <a href={l.url} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere', flex: 1 }}>
            {l.label || l.url}
          </a>
          <button
            className="btn small ghost"
            title="Retirer"
            onClick={() => {
              set(s.links.filter((_, j) => j !== i));
              toast('Lien retiré', { undo: () => set(s.links) });
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      {draft && (
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            let url = draft.url.trim();
            if (!url) return;
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
            set([...s.links, { url, label: draft.label.trim() }]);
            setDraft(null);
          }}
        >
          <input autoFocus placeholder="Adresse (https://…)" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} style={{ flex: 2, minWidth: 200 }} />
          <input placeholder="Description (vidéo sur les fractions…)" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} style={{ flex: 2, minWidth: 200 }} />
          <button className="btn primary small" type="submit">
            Ajouter
          </button>
          <button className="btn ghost small" type="button" onClick={() => setDraft(null)}>
            Annuler
          </button>
        </form>
      )}
      {!s.links.length && !draft && <span className="small muted">Vidéos, exercices en ligne, simulations…</span>}
    </div>
  );
}

// Points du programme travaillés : séquences et séances de la Progression, pour chaque matière suivie
function ProgrammePicker({ group, s }: { group: Group; s: TutoringSession }) {
  const units = useLiveQuery(() => db.units.toArray(), [], [] as Unit[]);
  const [open, setOpen] = useState<string | null>(null); // matière dont la liste est ouverte
  const chosen = s.unitIds.map((i) => units.find((u) => u.id === i)).filter(Boolean) as Unit[];
  async function toggle(u: Unit) {
    const ids = s.unitIds.includes(u.id) ? s.unitIds.filter((i) => i !== u.id) : [...s.unitIds, u.id];
    await db.tutoringSessions.update(s.id, { unitIds: ids });
    await syncPublications(s.groupId);
  }
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <h3 className="panel-title">
        <Icon name="target" size={16} /> Programme travaillé
      </h3>
      {chosen.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          {chosen.map((u) => (
            <span key={u.id} className="tag plain" style={{ whiteSpace: 'normal' }}>
              {(group.tracks?.length ?? 0) > 1 && <b>{unitSubject(u) === 'Mathématiques' ? 'Maths' : 'PC'}</b>} {unitLabel(u)}
              <button className="btn small ghost" style={{ border: 'none', padding: 0 }} title="Retirer" onClick={() => toggle(u)}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 6 }}>
        {(group.tracks ?? []).map((t) => (
          <button key={t.subject} className={'btn small' + (open === t.subject ? ' primary' : '')} onClick={() => setOpen(open === t.subject ? null : t.subject)}>
            {open === t.subject ? 'Fermer' : `Choisir dans ${trackLabel(t)}`}
          </button>
        ))}
      </div>
      {open &&
        (() => {
          const t = group.tracks!.find((x) => x.subject === open)!;
          const seqs = units.filter((u) => u.kind === 'sequence' && u.level === t.level && unitSubject(u) === t.subject).sort(byProgression);
          if (!seqs.length) return <span className="small muted">Pas encore de progression de {t.subject} en {t.level} (à créer dans la Progression).</span>;
          return (
            <div className="stack" style={{ gap: 2, maxHeight: 360, overflowY: 'auto' }}>
              {seqs.map((q) => (
                <div key={q.id} className="stack" style={{ gap: 0 }}>
                  <label className="prog-item small" style={{ fontWeight: 800 }}>
                    <input type="checkbox" checked={s.unitIds.includes(q.id)} onChange={() => toggle(q)} /> <span className="name">{unitLabel(q)}</span>
                  </label>
                  {units
                    .filter((u) => u.parentId === q.id)
                    .sort((a, b) => a.order - b.order)
                    .map((k) => (
                      <label key={k.id} className="prog-item small" style={{ paddingLeft: 28 }}>
                        <input type="checkbox" checked={s.unitIds.includes(k.id)} onChange={() => toggle(k)} /> <span className="name">{unitLabel(k)}</span>
                      </label>
                    ))}
                </div>
              ))}
            </div>
          );
        })()}
      <span className="small muted">Les flashcards et les documents de ces points sont proposés à l'élève à partir de la date de la séance.</span>
    </div>
  );
}

function CardsPanel({ group, s }: { group: Group; s: TutoringSession }) {
  const cards = useLiveQuery(async () => (await db.cards.bulkGet(s.cardIds)).filter((c) => c && !c.deleted).map((c) => c!), [s.cardIds], []);
  // Flashcards déjà données à l'élève (séances du suivi, points de la progression faits) : grisées dans le choix
  const given = useLiveQuery(
    async () => {
      const m = new Map<string, string>();
      for (const id of s.cardIds) m.set(id, 'dans cette séance');
      const all = await db.tutoringSessions.where('groupId').equals(s.groupId).toArray();
      for (const x of all.sort((a, b) => a.date.localeCompare(b.date)))
        for (const id of x.cardIds) if (!m.has(id)) m.set(id, `déjà le ${x.date.slice(8, 10)}/${x.date.slice(5, 7)}`);
      const unitIds = [...(await db.publications.where('groupId').equals(s.groupId).toArray()).map((p) => p.unitId), ...all.flatMap((x) => x.unitIds ?? [])];
      for (const uid of new Set(unitIds)) {
        const units = [uid, ...(await db.units.where('parentId').equals(uid).primaryKeys())];
        for (const l of await db.unitCards.where('unitId').anyOf(units).toArray()) if (!m.has(l.cardId)) m.set(l.cardId, 'déjà attribuée');
      }
      return m;
    },
    [s.id, s.groupId, s.cardIds.join(',')],
    new Map<string, string>(),
  );
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // ids : flashcards de la liste d'où l'on vient, pour passer à la précédente / suivante (◀ ▶)
  const [open, setOpen] = useState<{ id: string; edit: boolean; ids?: string[] } | null>(null);
  const set = (cardIds: string[]) => db.tutoringSessions.update(s.id, { cardIds });

  async function create(subject: string, level: string) {
    const now = Date.now();
    const id = uid();
    await db.cards.put({
      id,
      code: await cardCode({ level, origin: defaultOrigin() }),
      origin: defaultOrigin(),
      subject,
      level,
      tags: [level],
      front: '',
      back: '',
      createdAt: now,
      updatedAt: now,
      ocrDone: true,
    });
    await set([...s.cardIds, id]);
    setOpen({ id, edit: true, ids: [...cards.map((c) => c.id), id] });
  }

  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <div className="spread">
        <h3 className="panel-title">
          <Icon name="cards" size={16} /> Flashcards ajoutées
        </h3>
        <div className="row" style={{ gap: 6 }}>
          {(group.tracks ?? []).map((t) => (
            <button key={t.subject} className="btn small" onClick={() => create(t.subject, t.level)} title={`Le thème se choisit dans la fiche (${Object.values(themesOf(t.subject)).join(', ')})`}>
              <Icon name="plus" size={15} /> Nouvelle{(group.tracks?.length ?? 0) > 1 ? ` (${t.subject === 'Mathématiques' ? 'maths' : t.subject})` : ''}
            </button>
          ))}
          <button className="btn small" onClick={() => (setPicked(new Set()), setPicking(true))}>
            Choisir parmi les flashcards
          </button>
        </div>
      </div>
      {cards.length ? (
        <div className="cardgrid">
          {cards.map((c) => (
            <div key={c.id} className="thumb" onClick={() => setOpen({ id: c.id, edit: false, ids: cards.map((x) => x.id) })}>
              <div className="bar" style={{ background: themeColor(c.theme) }} />
              <div className="face">
                <CardFace html={c.front} />
              </div>
              <div className="meta">
                <span className="code">{c.code}</span>
                <span
                  className="small"
                  style={{ textDecoration: 'underline', marginLeft: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    set(s.cardIds.filter((i) => i !== c.id));
                    toast('Flashcard retirée de la séance', { undo: () => set(s.cardIds) });
                  }}
                >
                  retirer
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <span className="small muted">Les flashcards ajoutées ici entrent dans les révisions quotidiennes de l'élève.</span>
      )}
      {picking && (
        <>
          <div className="drawer-bg" onClick={() => setPicking(false)} />
          <div className="drawer full stack">
            {/* Boutons toujours visibles pendant le défilement */}
            <div className="spread" style={{ position: 'sticky', top: -20, zIndex: 2, background: 'var(--bg)', padding: '12px 0', margin: '-12px 0 0' }}>
              <h2 style={{ margin: 0 }}>Choisir des flashcards</h2>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn primary"
                  disabled={!picked.size}
                  onClick={async () => {
                    await set([...new Set([...s.cardIds, ...picked])]);
                    setPicking(false);
                    toast(`${picked.size} flashcard(s) ajoutée(s)`);
                  }}
                >
                  Ajouter ({picked.size})
                </button>
                <button className="btn ghost" onClick={() => setPicking(false)}>
                  Fermer
                </button>
              </div>
            </div>
            <CardBrowser
              picker
              selected={picked}
              exclude={given}
              onToggle={(cid) =>
                setPicked((prev) => {
                  const n = new Set(prev);
                  if (n.has(cid)) n.delete(cid);
                  else n.add(cid);
                  return n;
                })
              }
              onToggleMany={(ids, on) =>
                setPicked((prev) => {
                  const n = new Set(prev);
                  ids.forEach((i) => (on ? n.add(i) : n.delete(i)));
                  return n;
                })
              }
              onOpen={(c, ids) => setOpen({ id: c.id, edit: false, ids })}
            />
          </div>
        </>
      )}
      {open && (
        <CardDetail
          key={open.id}
          cardId={open.id}
          startEditing={open.edit}
          siblings={open.ids}
          onNavigate={(id, edit) => setOpen({ ...open, id, edit })}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
