// Échanges au sujet d'une copie : appréciation vocale du professeur (on voit si l'élève l'a écoutée),
// réponses de l'élève par écrit ou par mémo vocal. Rangés dans la messagerie, rattachés à l'évaluation.
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Message } from '../lib/db';
import { evalThread, markEvalRead, sendMessage } from '../lib/messages';
import { mediaUrl } from './CardFace';
import { frDate } from '../lib/dates';
import { toast } from './Toast';
import { Icon } from './Icon';

const time = (ts: number) => {
  const d = new Date(ts);
  return `${frDate(d.toISOString().slice(0, 10))} à ${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
};

// Enregistrement d'un mémo vocal : un appui pour démarrer, un autre pour arrêter
export function useVoiceRecorder(onDone: (blob: Blob) => void) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [since, setSince] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [rec]);
  async function toggle() {
    if (rec) return rec.stop();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('Enregistrement impossible sur cet appareil', { error: true });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      const r = new MediaRecorder(stream, { mimeType: type });
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        const blob = Object.assign(new Blob(chunks, { type }), { name: `vocal.${type === 'audio/mp4' ? 'm4a' : 'webm'}` });
        if (blob.size) onDone(blob);
      };
      r.start();
      setSince(Date.now());
      setRec(r);
    } catch {
      toast('Micro refusé : autorisez-le dans les réglages du navigateur', { error: true });
    }
  }
  const secs = rec ? Math.floor((Date.now() - since) / 1000) : 0;
  return { recording: !!rec, toggle, elapsed: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` };
}

function Audio({ m, onPlay }: { m: Message; onPlay?: () => void }) {
  const a = m.attachments.find((x) => x.type.startsWith('audio/'));
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (a) mediaUrl(a.mediaId).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [a?.mediaId]);
  if (!a) return null;
  return url ? <audio controls src={url} onPlay={onPlay} style={{ width: '100%', maxWidth: 360 }} /> : <span className="small muted">Vocal…</span>;
}

export function EvalFeedback({
  evaluationId,
  studentId,
  teacherId,
  me,
  role,
  studentName,
}: {
  evaluationId: string;
  studentId: string;
  teacherId?: string; // professeur de l'élève (côté élève : déduit du fil ou de ses classes)
  me: { id: string; name: string };
  role: 'prof' | 'eleve';
  studentName?: string;
}) {
  const thread = useLiveQuery(() => evalThread(evaluationId, studentId), [evaluationId, studentId], []);
  const fallbackTeacher = useLiveQuery(async () => {
    if (teacherId) return teacherId;
    const ms = await db.memberships.where('studentId').equals(studentId).toArray();
    const gs = await db.groups.bulkGet(ms.map((m) => m.groupId));
    return gs.find((g) => g && g.kind !== 'soutien')?.teacherIds[0];
  }, [teacherId, studentId]);
  const tId = teacherId ?? thread.find((m) => m.authorId !== studentId)?.teacherId ?? fallbackTeacher;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const sent = useRef(new Set<string>());
  // Le professeur a vu les réponses de l'élève
  useEffect(() => {
    if (role === 'prof' && thread.length) markEvalRead(me.id, evaluationId, studentId);
  }, [role, thread.length, me.id, evaluationId, studentId]);

  async function send(files: Blob[] = []) {
    if (!tId || (!text.trim() && !files.length)) return;
    setBusy(true);
    try {
      await sendMessage(
        { teacherId: tId, studentId, authorId: me.id, authorName: me.name, text: text.trim(), recipients: role === 'prof' ? [studentId] : [], evaluationId },
        files,
      );
      setText('');
      toast(files.length ? (role === 'prof' ? 'Appréciation vocale envoyée à l’élève' : 'Réponse vocale envoyée') : 'Réponse envoyée');
    } finally {
      setBusy(false);
    }
  }
  const voice = useVoiceRecorder((b) => send([b]));
  // Élève : l'écoute d'un vocal du professeur est signalée une fois (accusé d'écoute visible par le professeur)
  async function heard(m: Message) {
    if (role !== 'eleve' || !tId || sent.current.has(m.id) || thread.some((x) => x.heardOf === m.id)) return;
    sent.current.add(m.id);
    await sendMessage({ teacherId: tId, studentId, authorId: me.id, authorName: me.name, text: '', recipients: [], evaluationId, heardOf: m.id });
  }
  async function remove(m: Message) {
    await db.messages.delete(m.id);
    toast('Vocal supprimé', { undo: () => db.messages.put(m) });
  }

  const shown = thread.filter((m) => !m.heardOf);
  const heardAt = (m: Message) => thread.find((x) => x.heardOf === m.id)?.createdAt;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {shown.map((m) => {
        const mine = m.authorId === me.id;
        const fromTeacher = m.authorId !== studentId;
        const isAudio = m.attachments.some((a) => a.type.startsWith('audio/'));
        const h = heardAt(m);
        return (
          <div key={m.id} className={'eval-msg' + (fromTeacher ? ' teacher' : ' student')}>
            <div className="small muted">
              {fromTeacher ? (role === 'prof' ? 'Moi' : 'Le professeur') : role === 'eleve' ? 'Moi' : (studentName ?? 'L’élève')} · {time(m.createdAt)}
            </div>
            {m.text && <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>}
            <Audio m={m} onPlay={fromTeacher ? () => heard(m) : undefined} />
            {role === 'prof' && fromTeacher && isAudio && (
              <div className="row" style={{ gap: 8 }}>
                {h ? (
                  <span className="tag ok">
                    <Icon name="check" size={13} /> écouté le {time(h)}
                  </span>
                ) : (
                  <span className="tag plain">pas encore écouté</span>
                )}
                {mine && !h && (
                  <button className="btn small ghost" onClick={() => remove(m)} title="Supprimer ce vocal">
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <button className={'btn' + (voice.recording ? ' danger' : role === 'prof' && !shown.length ? ' primary' : '')} onClick={voice.toggle} disabled={busy || !tId}>
          <Icon name="mic" />{' '}
          {voice.recording ? `Arrêter et envoyer (${voice.elapsed})` : role === 'prof' ? 'Appréciation vocale' : 'Répondre par un vocal'}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={role === 'prof' ? 'Ou un message écrit…' : 'Répondre par écrit…'}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button className="btn" onClick={() => send()} disabled={busy || !text.trim() || !tId}>
          Envoyer
        </button>
      </div>
    </div>
  );
}
