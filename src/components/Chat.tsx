// Fil de discussion (professeur, élève ou parents) : messages, photos, documents, mémos vocaux.
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Message, type Thread } from '../lib/db';
import { markRead, sendMessage } from '../lib/messages';
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

export function Chat({
  teacherId,
  studentId,
  thread,
  me,
  title,
  hint,
}: {
  teacherId: string;
  studentId: string;
  thread: Thread;
  me: { id: string; name: string };
  title?: string;
  hint?: string;
}) {
  const msgs = useLiveQuery(
    async () =>
      (await db.messages.where('[studentId+thread]').equals([studentId, thread]).filter((m) => m.teacherId === teacherId).toArray()).sort(
        (a, b) => a.createdAt - b.createdAt,
      ),
    [teacherId, studentId, thread],
    [],
  );
  const [text, setText] = useState('');
  const [files, setFiles] = useState<(File | Blob)[]>([]);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const last = msgs[msgs.length - 1];

  // Le fil affiché est lu
  useEffect(() => {
    if (last) markRead(me.id, teacherId, studentId, thread, last.createdAt);
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [last?.id, me.id, teacherId, studentId, thread]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (!text.trim() && !files.length) return;
    setBusy(true);
    try {
      await sendMessage({ teacherId, studentId, thread, authorId: me.id, authorName: me.name, text: text.trim() }, files);
      setText('');
      setFiles([]);
    } finally {
      setBusy(false);
    }
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
      toast("Micro refusé : autorisez-le dans les réglages du navigateur", { error: true });
    }
  }

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
              <div className="small muted">
                {mine ? 'Moi' : m.authorName} · {time(m.createdAt)}
              </div>
              {m.text && <RichText text={m.text} />}
              {m.attachments.map((a) => (
                <Attachment key={a.mediaId} a={a} />
              ))}
            </div>
          );
        })}
        <div ref={end} />
      </div>
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
        placeholder="Écrire un message… (formules entre $ … $)"
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
