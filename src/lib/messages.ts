// Fils de discussion : un fil « eleve » (élève ↔ professeur) et un fil « parents » (parents ↔ professeur) par élève.
// Pièces jointes (photo, document, mémo vocal) rangées sous msg/<élève>/<fil>/… ; un e-mail prévient le destinataire
// s'il l'a demandé (fonction serveur « notify »).
import { db, fileBlob, uid, type Message, type Thread } from './db';
import { ONLINE, supabase } from './supabase';
import { push } from './sync';

export const readId = (userId: string, teacherId: string, studentId: string, thread: Thread) => `${userId}|${teacherId}|${studentId}|${thread}`;

export async function sendMessage(m: Omit<Message, 'id' | 'createdAt' | 'attachments'>, files: (File | Blob)[] = []) {
  const attachments: Message['attachments'] = [];
  for (const f of files) {
    const mediaId = `msg/${m.studentId}/${m.thread}/${uid()}`;
    const name = f instanceof File ? f.name || 'photo.jpg' : (f as Blob & { name?: string }).name ?? 'fichier';
    await db.media.put({ id: mediaId, name, blob: f instanceof File ? await fileBlob(f) : f });
    attachments.push({ mediaId, name, size: f.size, type: f.type });
  }
  const msg: Message = { ...m, id: uid(), attachments, createdAt: Date.now() };
  await db.messages.put(msg);
  await markRead(m.authorId, m.teacherId, m.studentId, m.thread, msg.createdAt);
  if (ONLINE) notifyLater(msg.id);
  return msg;
}

// Une fois le message enregistré en ligne, la fonction serveur prévient le destinataire par e-mail (s'il le souhaite)
async function notifyLater(id: string) {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    await push().catch(() => undefined);
    if (!(await db.outbox.get(`messages|${id}`))) break;
  }
  await supabase.functions.invoke('notify', { body: { messageId: id } }).catch(() => undefined);
}

export async function markRead(userId: string, teacherId: string, studentId: string, thread: Thread, at: number) {
  const id = readId(userId, teacherId, studentId, thread);
  const cur = await db.messageReads.get(id);
  if (!cur || cur.at < at) await db.messageReads.put({ id, userId, at });
}

// Messages non lus par `userId` dans un fil
export async function unreadIn(userId: string, teacherId: string, studentId: string, thread: Thread) {
  const r = await db.messageReads.get(readId(userId, teacherId, studentId, thread));
  return db.messages
    .where('[studentId+thread]')
    .equals([studentId, thread])
    .filter((m) => m.teacherId === teacherId && m.authorId !== userId && m.createdAt > (r?.at ?? 0))
    .count();
}

// Tous les messages non lus de l'utilisateur connecté (pastille du menu), dans les seuls fils qui le concernent
export async function unreadTotal(userId: string, role: 'prof' | 'eleve' | 'parent') {
  const reads = new Map((await db.messageReads.toArray()).filter((r) => r.userId === userId).map((r) => [r.id, r.at]));
  const children = role === 'parent' ? new Set((await db.parents.get(userId))?.studentIds ?? []) : null;
  const mine = (m: Message) =>
    role === 'prof' ? m.teacherId === userId : role === 'eleve' ? m.thread === 'eleve' && m.studentId === userId : m.thread === 'parents' && children!.has(m.studentId);
  return db.messages.filter((m) => mine(m) && m.authorId !== userId && m.createdAt > (reads.get(readId(userId, m.teacherId, m.studentId, m.thread)) ?? 0)).count();
}
