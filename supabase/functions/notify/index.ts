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
    const { messageId } = (await req.json()) as { messageId: string };
    const { data: msg } = await admin.from('messages').select('teacher_id, student_id, thread, author_id, data').eq('id', messageId).maybeSingle();
    // Seul l'auteur du message peut demander la notification
    if (!msg || msg.author_id !== uid) return json({ error: 'Message introuvable' }, 404);
    const key = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('NOTIFY_FROM');
    if (!key || !from) return json({ sent: 0, reason: 'envoi d’e-mails non configuré' });

    // Destinataires : le professeur si l'auteur est l'élève ou un parent ; sinon l'élève (fil élève) ou les parents (fil parents)
    const to: string[] = [];
    if (msg.author_id !== msg.teacher_id) {
      const { data: t } = await admin.from('teachers').select('data').eq('id', msg.teacher_id).single();
      if (t?.data.notifyEmail !== false) {
        const { data: u } = await admin.auth.admin.getUserById(msg.teacher_id);
        const e = realEmail(u.user?.email);
        if (e) to.push(e);
      }
    } else if (msg.thread === 'eleve') {
      const { data: s } = await admin.from('students').select('data').eq('id', msg.student_id).single();
      const e = realEmail(s?.data.notifyEmail);
      if (e) to.push(e);
    } else {
      const { data: ps } = await admin.from('parents').select('id, data').contains('student_ids', [msg.student_id]).eq('deleted', false);
      for (const p of ps ?? []) {
        if (p.data.notifyEmail === false) continue;
        const { data: u } = await admin.auth.admin.getUserById(p.id);
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
    const subject = `FoxBox – nouveau message de ${author}${msg.thread === 'parents' && msg.author_id === msg.teacher_id ? ` au sujet de ${child}` : ''}`;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html =
      `<p>${esc(author)} vous a écrit${child ? ` (fil « ${esc(child)} »)` : ''} :</p>` +
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
