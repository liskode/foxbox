// Messages : une conversation par élève (et par professeur). Chaque message a ses destinataires, choisis parmi
// l'élève et ses parents (le professeur reçoit toujours les messages de l'élève et des parents) ; chacun ne lit que
// les messages qu'il a écrits ou qui lui sont adressés. Pièces jointes (photo, document, mémo vocal) rangées sous
// msg/<élève>/<eleve|parents|tous>/… ; un e-mail prévient les destinataires qui l'ont demandé (fonction « notify »).
import { db, fileBlob, uid, type Message } from './db';
import { ONLINE, supabase } from './supabase';
import { push } from './sync';

export const readId = (userId: string, teacherId: string, studentId: string) => `${userId}|${teacherId}|${studentId}|conv`;

// Destinataires d'un message (les plus anciens n'en ont pas : on les déduit de leur fil)
export async function recipientsOf(m: Message): Promise<string[]> {
  if (m.recipients) return m.recipients;
  if (m.thread === 'eleve') return [m.studentId];
  return (await db.parents.where('studentIds').equals(m.studentId).primaryKeys()) as string[];
}
const recipientsSync = (m: Message, parentIds: string[]) => m.recipients ?? (m.thread === 'eleve' ? [m.studentId] : parentIds);

// Messages d'une conversation visibles par `userId` (le professeur voit tout)
export async function conversation(teacherId: string, studentId: string, userId: string) {
  const parentIds = (await db.parents.where('studentIds').equals(studentId).primaryKeys()) as string[];
  const all = (await db.messages.where('studentId').equals(studentId).toArray()).filter((m) => m.teacherId === teacherId);
  return all
    .map((m) => ({ ...m, recipients: recipientsSync(m, parentIds) }))
    .filter((m) => userId === teacherId || m.authorId === userId || m.recipients.includes(userId))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function sendMessage(
  m: Omit<Message, 'id' | 'createdAt' | 'attachments' | 'thread'> & { recipients: string[] },
  files: (File | Blob)[] = [],
) {
  // Fil (pour les règles d'accès des pièces jointes) : élève seul, parents seuls, ou tous
  const toStudent = m.recipients.includes(m.studentId) || m.authorId === m.studentId;
  const toParents = m.recipients.some((r) => r !== m.studentId && r !== m.teacherId) || (m.authorId !== m.studentId && m.authorId !== m.teacherId);
  const folder = toStudent && toParents ? 'tous' : toStudent ? 'eleve' : 'parents';
  const attachments: Message['attachments'] = [];
  for (const f of files) {
    const mediaId = `msg/${m.studentId}/${folder}/${uid()}`;
    const name = f instanceof File ? f.name || 'photo.jpg' : ((f as Blob & { name?: string }).name ?? 'fichier');
    await db.media.put({ id: mediaId, name, blob: f instanceof File ? await fileBlob(f) : f });
    attachments.push({ mediaId, name, size: f.size, type: f.type });
  }
  const msg: Message = { ...m, thread: toParents ? 'parents' : 'eleve', id: uid(), attachments, createdAt: Date.now() };
  await db.messages.put(msg);
  await markRead(m.authorId, m.teacherId, m.studentId, msg.createdAt);
  if (ONLINE) notifyLater(msg.id);
  return msg;
}

// Une fois le message enregistré en ligne, la fonction serveur prévient les destinataires par e-mail (s'ils le souhaitent)
async function notifyLater(id: string) {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    await push().catch(() => undefined);
    if (!(await db.outbox.get(`messages|${id}`))) break;
  }
  await supabase.functions.invoke('notify', { body: { messageId: id } }).catch(() => undefined);
}

export async function markRead(userId: string, teacherId: string, studentId: string, at: number) {
  const id = readId(userId, teacherId, studentId);
  const cur = await db.messageReads.get(id);
  if (!cur || cur.at < at) await db.messageReads.put({ id, userId, at });
}

// Messages non lus par `userId` dans une conversation
export async function unreadIn(userId: string, teacherId: string, studentId: string) {
  const r = await db.messageReads.get(readId(userId, teacherId, studentId));
  return (await conversation(teacherId, studentId, userId)).filter((m) => m.authorId !== userId && m.createdAt > (r?.at ?? 0)).length;
}

// Tous les messages non lus de l'utilisateur connecté (pastille du menu)
export async function unreadTotal(userId: string, role: 'prof' | 'eleve' | 'parent') {
  const convs = new Set<string>();
  for (const m of await db.messages.toArray()) convs.add(`${m.teacherId}|${m.studentId}`);
  let n = 0;
  for (const c of convs) {
    const [t, s] = c.split('|');
    if (role === 'prof' && t !== userId) continue;
    n += await unreadIn(userId, t, s);
  }
  return n;
}
