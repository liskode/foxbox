// Fil de discussion (professeur, élève ou parents) : messages, photos, documents, mémos vocaux.
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Message, type Student } from '../lib/db';
import { codeFor, type Relation } from '../lib/relations';
import { usePhoto } from './Avatar';
import { conversation, markRead, sendMessage } from '../lib/messages';
import { frDate } from '../lib/dates';
import { mediaUrl, RichText } from './CardFace';
import { openDocument, sizeLabel } from './UnitDetails';
import { toast } from './Toast';
import { Icon } from './Icon';

function useMedia(id: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    mediaUrl(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

function Attachment({ a }: { a: Message['attachments'][number] }) {
  const url = useMedia(a.mediaId);
  if (a.type.startsWith('image/'))
    return url ? (
      <img src={url} alt={a.name} onClick={() => openDocument(a.mediaId, a.name)} style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, cursor: 'zoom-in', display: 'block' }} />
    ) : (
      <span className="small muted">Photo…</span>
    );
  if (a.type.startsWith('audio/')) return url ? <audio controls src={url} style={{ maxWidth: '100%' }} /> : <span className="small muted">Mémo vocal…</span>;
  return (
    <button className="btn small" onClick={() => openDocument(a.mediaId, a.name)} title={sizeLabel(a.size)}>
      <Icon name="file" size={15} /> {a.name}
    </button>
  );
}

const time = (ts: number) => {
  const d = new Date(ts);
  return `${frDate(d.toISOString().slice(0, 10))} ${String(d.getHours()).padStart(2, '0')} h ${String(d.getMinutes()).padStart(2, '0')}`;
};

// Petit rond en haut à gauche d'un message : photo de l'élève, photo ou logo du professeur, code d'un parent (P, M…)
function Face({
  m,
  studentId,
  teacherId,
  faces,
}: {
  m: Message;
  studentId: string;
  teacherId: string;
  faces?: { student?: Student; teacherPhotoId?: string; relations?: Relation[] };
}) {
  const isStudent = m.authorId === studentId;
  const isTeacher = m.authorId === teacherId;
  const url = usePhoto(isStudent ? faces?.student?.photoId : isTeacher ? faces?.teacherPhotoId : undefined);
  const initials = m.authorName
    .split(/[\s.–-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="msg-badge" title={m.authorName}>
      {url ? <img src={url} alt="" /> : isStudent || isTeacher ? initials : codeFor(m.authorName, faces?.relations)}
    </span>
  );
}

export interface Person {
  id: string;
  name: string;
}

export function Chat({
  teacherId,
  studentId,
  me,
  role,
  title,
  hint,
}: {
  teacherId: string;
  studentId: string;
  me: Person;
  role: 'prof' | 'eleve' | 'parent';
  title?: string;
  hint?: string;
}) {
  const msgs = useLiveQuery(() => conversation(teacherId, studentId, me.id), [teacherId, studentId, me.id], []);
  // Destinataires possibles. Professeur : l'élève et ses parents. Élève ou parent : les personnes du dernier
  // message reçu (« répondre à tous »), le professeur recevant toujours.
  const people = useLiveQuery(
    async () => {
      if (role === 'prof') {
        const st = await db.students.get(studentId);
        const ps = await db.parents.where('studentIds').equals(studentId).toArray();
        return [...(st ? [{ id: st.id, name: st.firstName }] : []), ...ps.map((p) => ({ id: p.id, name: p.name }))];
      }
      return [] as Person[];
    },
    [role, studentId],
    [] as Person[],
  );
  // Photo de l'élève, photo du professeur et codes des interlocuteurs (recopiés dans le groupe de soutien)
  const faces = useLiveQuery(
    async () => {
      const st = await db.students.get(studentId);
      const ms = await db.memberships.where('studentId').equals(studentId).toArray();
      const g = (await db.groups.bulkGet(ms.map((m) => m.groupId))).find((x) => x?.kind === 'soutien' && x.teacherIds.includes(teacherId));
      const t = role === 'prof' ? await db.teachers.get(teacherId) : undefined;
      return { student: st, teacherPhotoId: t?.photoId ?? g?.teacherPhotoId, relations: t?.relations ?? g?.relations };
    },
    [studentId, teacherId, role],
  );
  const last = msgs[msgs.length - 1];
  const lastIn = [...msgs].reverse().find((m) => m.authorId !== me.id) ?? last;
  const names = (m?: Message) => ({ ...(m?.recipientNames ?? {}), ...(m ? { [m.authorId]: m.authorName } : {}) });
  const options: Person[] =
    role === 'prof'
      ? people
      : lastIn
        ? [...new Set([lastIn.authorId, ...(lastIn.recipients ?? [])])]
            .filter((id) => id !== me.id && id !== teacherId)
            .map((id) => ({ id, name: names(lastIn)[id] ?? (id === studentId ? 'l’élève' : 'un parent') }))
        : [];
  const defaults = (): string[] => {
    const ids = options.map((o) => o.id);
    if (role !== 'prof') return ids;
    if (lastIn) {
      const reply = [...new Set([lastIn.authorId, ...(lastIn.recipients ?? [])])].filter((id) => id !== me.id && ids.includes(id));
      if (reply.length) return reply;
    }
    const parents = ids.filter((id) => id !== studentId);
    return parents.length ? parents : ids;
  };
  const [to, setTo] = useState<string[] | null>(null); // null : choix par défaut
  const chosen = to ?? defaults();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<(File | Blob)[]>([]);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // La conversation affichée est lue ; à chaque nouveau message, le choix des destinataires revient au défaut
  useEffect(() => {
    if (last) markRead(me.id, teacherId, studentId, last.createdAt);
    end.current?.scrollIntoView({ block: 'nearest' });
    setTo(null);
  }, [last?.id, me.id, teacherId, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (!text.trim() && !files.length) return;
    if (role === 'prof' && !chosen.length) return toast('Cochez au moins un destinataire', { error: true });
    setBusy(true);
    try {
      const recipientNames = Object.fromEntries(options.filter((o) => chosen.includes(o.id)).map((o) => [o.id, o.name]));
      await sendMessage({ teacherId, studentId, authorId: me.id, authorName: me.name, text: text.trim(), recipients: [...new Set(chosen)], recipientNames }, files);
      setText('');
      setFiles([]);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const m = msgs.find((x) => x.id === editing.id);
    if (m && editing.text.trim() !== m.text) await db.messages.update(m.id, { text: editing.text.trim(), editedAt: Date.now() });
    setEditing(null);
  }

  // Mémo vocal : appui pour démarrer, nouvel appui pour arrêter (le mémo est joint au message)
  async function toggleRecord() {
    if (rec) {
      rec.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('Enregistrement impossible sur cet appareil', { error: true });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      const r = new MediaRecorder(stream, { mimeType: type });
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = Object.assign(new Blob(chunks, { type }), { name: `memo-vocal.${type === 'audio/mp4' ? 'm4a' : 'webm'}` });
        setFiles((f) => [...f, blob]);
        setRec(null);
      };
      r.start();
      setRec(r);
    } catch {
      toast('Micro refusé : autorisez-le dans les réglages du navigateur', { error: true });
    }
  }

  // « à moi, Mère – …, Nino » : le professeur reçoit toujours les messages de l'élève et des parents
  const known = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const toLabel = (m: Message) => {
    const ids = [...new Set(m.recipients ?? [])].filter((id) => id !== me.id && id !== m.authorId);
    const n = ids.map((id) => (m.recipientNames ?? {})[id] ?? known[id] ?? (id === studentId ? 'l’élève' : 'un parent'));
    if (m.authorId !== teacherId) n.unshift(me.id === teacherId ? 'moi' : 'le professeur');
    if (m.authorId !== me.id && me.id !== teacherId && m.recipients?.includes(me.id)) n.unshift('moi');
    return n.length ? `à ${n.join(', ')}` : '';
  };

  return (
    <div className="panel stack chat" style={{ gap: 10 }}>
      {title && <h3 className="panel-title">{title}</h3>}
      {hint && <span className="small muted">{hint}</span>}
      <div className="stack chat-list" style={{ gap: 8 }}>
        {!msgs.length && <span className="small muted">Aucun message pour l'instant.</span>}
        {msgs.map((m) => {
          const mine = m.authorId === me.id;
          return (
            <div key={m.id} className={'bubble' + (mine ? ' mine' : '')}>
              <div className="bubble-head">
                <Face m={m} studentId={studentId} teacherId={teacherId} faces={faces} />
                <span className="small muted">
                  {mine ? 'Moi' : m.authorName} {toLabel(m)} · {time(m.createdAt)}
                  {m.editedAt ? ' · modifié' : ''}
                </span>
              </div>
              {editing?.id === m.id ? (
                <div className="stack" style={{ gap: 6 }}>
                  <textarea
                    aria-label="Corriger le message"
                    autoFocus
                    value={editing.text}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && saveEdit()}
                    style={{ fontFamily: 'var(--font)', fontSize: '0.95rem', minHeight: 70, background: 'var(--paper)' }}
                  />
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn small primary" onClick={saveEdit}>
                      Enregistrer
                    </button>
                    <button className="btn small ghost" onClick={() => setEditing(null)}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                m.text && <RichText text={m.text} />
              )}
              {m.attachments.map((a) => (
                <Attachment key={a.mediaId} a={a} />
              ))}
              {mine && !editing && m.text && (
                <a href="#" className="small muted" style={{ alignSelf: 'flex-end' }} onClick={(e) => (e.preventDefault(), setEditing({ id: m.id, text: m.text }))}>
                  modifier
                </a>
              )}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {(options.length > 0 || role !== 'prof') && (
        <div className="row small" style={{ gap: 12 }}>
          <b>À :</b>
          {role !== 'prof' && (
            <label className="row" style={{ gap: 4 }}>
              <input type="checkbox" checked disabled /> le professeur
            </label>
          )}
          {options.map((o) => (
            <label key={o.id} className="row" style={{ gap: 4, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={chosen.includes(o.id)}
                onChange={(e) => {
                  const on = e.target.checked;
                  setTo((prev) => {
                    const cur = prev ?? chosen;
                    return on ? [...new Set([...cur, o.id])] : cur.filter((x) => x !== o.id);
                  });
                }}
              />
              {o.name}
              {role === 'prof' && o.id === studentId ? ' (élève)' : ''}
            </label>
          ))}
        </div>
      )}
      {role === 'prof' && !options.length && <span className="small muted">Pas encore de destinataire : l'élève et ses accès parents apparaîtront ici.</span>}
      {files.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          {files.map((f, i) => (
            <span key={i} className="tag plain">
              <Icon name={f.type.startsWith('audio/') ? 'mic' : f.type.startsWith('image/') ? 'camera' : 'file'} size={13} />{' '}
              {f.type.startsWith('audio/') ? 'Mémo vocal' : (f as File).name}
              <button className="btn small ghost" style={{ border: 'none', padding: 0 }} title="Retirer" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        aria-label="Message"
        placeholder="Écrire un message…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && send()}
        style={{ fontFamily: 'var(--font)', fontSize: '0.95rem', minHeight: 70 }}
      />
      <div className="row" style={{ gap: 8 }}>
        <label className="btn small" title="Photo ou document">
          <Icon name="camera" size={15} /> Photo / fichier
          <input
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const l = e.target.files;
              if (l?.length) setFiles((f) => [...f, ...l]);
              e.target.value = '';
            }}
          />
        </label>
        <button className={'btn small' + (rec ? ' danger' : '')} onClick={toggleRecord}>
          <Icon name={rec ? 'x' : 'mic'} size={15} /> {rec ? 'Arrêter l’enregistrement' : 'Mémo vocal'}
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn primary" disabled={busy || !!rec || (!text.trim() && !files.length)} onClick={send}>
          {busy ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
    </div>
  );
}
