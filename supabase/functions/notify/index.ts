// Fonction serveur : prévient par e-mail le destinataire d'un nouveau message, s'il l'a demandé dans ses réglages.
// Envoi par Resend (https://resend.com) : secrets RESEND_API_KEY et NOTIFY_FROM (ex. « FoxBox <foxbox@physifox.fr> »).
// Sans ces secrets, la fonction ne fait rien (les messages restent visibles dans FoxBox).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = 'https://foxbox.physifox.fr/';
const STUDENT_DOMAIN = 'eleves.foxbox.app';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const realEmail = (e?: string) => (e && e.includes('@') && !e.endsWith(`@${STUDENT_DOMAIN}`) ? e : undefined);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: who } = await admin.auth.getUser(token);
    const uid = who.user?.id;
    if (!uid) return json({ error: 'Non connecté' }, 401);
    // Démo en lecture seule : aucune action depuis une session de démo
    try {
      const sid = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id;
      const { data: demo } = await admin.from('demo_sessions').select('id').eq('id', sid).maybeSingle();
      if (demo) return json({ error: 'Démo : rien n’est enregistré.' }, 403);
    } catch {
      /* jeton illisible : refusé plus haut par getUser */
    }
    const { messageId } = (await req.json()) as { messageId: string };
    const { data: msg } = await admin.from('messages').select('teacher_id, student_id, thread, author_id, recipient_ids, data').eq('id', messageId).maybeSingle();
    // Seul l'auteur du message peut demander la notification
    if (!msg || msg.author_id !== uid) return json({ error: 'Message introuvable' }, 404);
    const key = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('NOTIFY_FROM');
    if (!key || !from) return json({ sent: 0, reason: 'envoi d’e-mails non configuré' });

    // Destinataires : ceux cochés dans le message, et le professeur quand l'auteur est l'élève ou un parent
    const ids = new Set<string>((msg.recipient_ids as string[] | null) ?? []);
    if (msg.author_id !== msg.teacher_id) ids.add(msg.teacher_id);
    ids.delete(msg.author_id);
    const to: string[] = [];
    for (const id of ids) {
      if (id === msg.teacher_id) {
        const { data: t } = await admin.from('teachers').select('data').eq('id', id).single();
        if (t?.data.notifyEmail === false) continue;
        const { data: u } = await admin.auth.admin.getUserById(id);
        const e = realEmail(u.user?.email);
        if (e) to.push(e);
      } else if (id === msg.student_id) {
        const { data: st } = await admin.from('students').select('data').eq('id', id).single();
        const e = realEmail(st?.data.notifyEmail);
        if (e) to.push(e);
      } else {
        const { data: p } = await admin.from('parents').select('data').eq('id', id).eq('deleted', false).maybeSingle();
        if (!p || p.data.notifyEmail === false) continue;
        const { data: u } = await admin.auth.admin.getUserById(id);
        const e = realEmail(u.user?.email);
        if (e) to.push(e);
      }
    }
    if (!to.length) return json({ sent: 0 });

    const { data: st } = await admin.from('students').select('data').eq('id', msg.student_id).single();
    const child = `${st?.data.firstName ?? ''} ${st?.data.lastName ?? ''}`.trim();
    const author = (msg.data.authorName as string) || 'FoxBox';
    const text = String(msg.data.text ?? '').slice(0, 500);
    const files = (msg.data.attachments as unknown[] | undefined)?.length ?? 0;
    const subject = `FoxBox – nouveau message de ${author}${child && msg.author_id !== msg.student_id ? ` au sujet de ${child}` : ''}`;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html =
      `<p>${esc(author)} vous a écrit${child ? ` (conversation au sujet de ${esc(child)})` : ''} :</p>` +
      (text ? `<blockquote style="border-left:3px solid #f2be4e;margin:0;padding:4px 12px;white-space:pre-line">${esc(text)}</blockquote>` : '') +
      (files ? `<p>${files} pièce(s) jointe(s).</p>` : '') +
      `<p><a href="${SITE}">Ouvrir FoxBox pour répondre</a></p>` +
      `<p style="color:#888;font-size:12px">Vous recevez cet e-mail car les notifications sont activées dans vos réglages FoxBox.</p>`;
    let sent = 0;
    for (const addr of [...new Set(to)]) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: addr, subject, html }),
      });
      if (r.ok) sent++;
    }
    return json({ sent });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
