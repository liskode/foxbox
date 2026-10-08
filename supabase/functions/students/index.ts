// Fonction serveur : création des comptes élèves et réinitialisation des mots de passe.
// Elle seule détient la clé d'administration ; elle vérifie d'abord que l'appelant est professeur de la classe.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const STUDENT_DOMAIN = 'eleves.foxbox.app';
const WORDS = ['atome', 'photon', 'neutron', 'proton', 'renard', 'comete', 'orbite', 'quartz', 'cristal', 'dipole',
  'ampere', 'newton', 'joule', 'plasma', 'nuage', 'galaxie', 'meteore', 'aimant', 'prisme', 'laser'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// Identifiant prenom.nom ; si le prénom manque (nom coupé dans un trombinoscope), seulement le nom
const baseLogin = (firstName: string, lastName: string) =>
  [normalize(firstName), normalize(lastName)].filter(Boolean).join('.') || 'eleve';
const password = () =>
  WORDS[Math.floor(Math.random() * WORDS.length)] + String(Math.floor(Math.random() * 90) + 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: who } = await admin.auth.getUser(token);
    const uid = who.user?.id;
    if (!uid) return json({ error: 'Non connecté' }, 401);
    const { data: teacher } = await admin.from('teachers').select('school_id').eq('id', uid).eq('deleted', false).maybeSingle();
    if (!teacher) return json({ error: 'Réservé aux professeurs' }, 403);

    const body = await req.json();

    if (body.action === 'create') {
      const { groupId, students } = body as { groupId: string; students: { firstName: string; lastName: string }[] };
      const { data: group } = await admin.from('groups').select('teacher_ids, data').eq('id', groupId).maybeSingle();
      if (!group || !group.teacher_ids.includes(uid)) return json({ error: 'Classe introuvable' }, 403);
      const subject = group.data.subject as string;

      const { data: existing } = await admin.from('students').select('id, data').eq('school_id', teacher.school_id);
      const known = existing ?? [];
      const logins = new Set(known.map((s) => s.data.login as string));
      let created = 0;
      let reused = 0;

      for (const st of students) {
        const firstName = st.firstName.trim();
        const lastName = st.lastName.trim();
        let row = known.find(
          (s) => normalize(s.data.firstName) === normalize(firstName) && normalize(s.data.lastName) === normalize(lastName),
        );
        if (row) {
          reused++;
          if (row.data.goals?.[subject] === undefined) {
            row.data.goals = { ...(row.data.goals ?? {}), [subject]: 15 };
            await admin.from('students').update({ data: row.data }).eq('id', row.id);
          }
        } else {
          const base = baseLogin(firstName, lastName);
          let login = base;
          for (let n = 2; logins.has(login); n++) login = base + n;
          logins.add(login);
          const pw = password();
          const { data: u, error } = await admin.auth.admin.createUser({
            email: `${login}@${STUDENT_DOMAIN}`,
            password: pw,
            email_confirm: true,
            user_metadata: { role: 'eleve' },
          });
          if (error) throw error;
          const data = { id: u.user.id, firstName, lastName, login, password: pw, rule: 'strict', goals: { [subject]: 15 } };
          const { error: e2 } = await admin.from('students').insert({ id: u.user.id, school_id: teacher.school_id, data });
          if (e2) throw e2;
          row = { id: u.user.id, data };
          known.push(row);
          created++;
        }
        const mid = `${groupId}|${row.id}`;
        await admin.from('memberships').upsert({
          id: mid, group_id: groupId, student_id: row.id, deleted: false,
          data: { id: mid, groupId, studentId: row.id },
        });
      }
      return json({ created, reused });
    }

    if (body.action === 'rename') {
      const { studentId, firstName, lastName } = body as { studentId: string; firstName: string; lastName: string };
      const { data: mine } = await admin.rpc('my_student_ids_for', { teacher: uid });
      if (!(mine as string[] | null)?.includes(studentId)) return json({ error: 'Élève introuvable' }, 403);
      const { data: s } = await admin.from('students').select('data, school_id').eq('id', studentId).single();
      const { data: others } = await admin.from('students').select('id, data').eq('school_id', s!.school_id).neq('id', studentId);
      const taken = new Set((others ?? []).map((o) => o.data.login as string));
      const base = baseLogin(firstName, lastName);
      let login = base;
      for (let n = 2; taken.has(login); n++) login = base + n;
      if (login !== s!.data.login) {
        const { error } = await admin.auth.admin.updateUserById(studentId, { email: `${login}@${STUDENT_DOMAIN}`, email_confirm: true });
        if (error) throw error;
      }
      const data = { ...s!.data, firstName: firstName.trim(), lastName: lastName.trim(), login };
      await admin.from('students').update({ data }).eq('id', studentId);
      return json({ login });
    }

    if (body.action === 'reset') {
      const { studentId } = body as { studentId: string };
      const { data: mine } = await admin.rpc('my_student_ids_for', { teacher: uid });
      if (!(mine as string[] | null)?.includes(studentId)) return json({ error: 'Élève introuvable' }, 403);
      const pw = password();
      const { error } = await admin.auth.admin.updateUserById(studentId, { password: pw });
      if (error) throw error;
      const { data: s } = await admin.from('students').select('data').eq('id', studentId).single();
      await admin.from('students').update({ data: { ...s!.data, password: pw } }).eq('id', studentId);
      return json({ password: pw });
    }

    return json({ error: 'Action inconnue' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
