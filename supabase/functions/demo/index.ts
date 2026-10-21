// Fonction serveur de la démo en lecture seule (lien public, sans mot de passe).
//  - { action: 'info' } : démo active ? quels profils (professeur, élève en classe, élève en soutien, parent) ?
//  - { action: 'login', profile } : ouvre une session sur le profil choisi par le professeur dans ses Réglages.
// La session est notée dans demo_sessions : le serveur y refuse toute modification (voir la migration « demo »).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PROFILES = ['prof', 'eleve', 'soutien', 'parent'] as const;
type Profile = (typeof PROFILES)[number];
interface DemoData {
  enabled?: boolean;
  intro?: string;
  prof?: string; // identifiants des comptes utilisés pour chaque profil
  eleve?: string;
  soutien?: string;
  parent?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { action, profile } = (await req.json()) as { action: string; profile?: Profile };

    // Une seule démo active : la plus récemment modifiée
    const { data: rows } = await admin.from('demo_config').select('teacher_id, data, updated_at').order('updated_at', { ascending: false });
    const cfg = (rows ?? []).find((r) => (r.data as DemoData).enabled);
    const data = (cfg?.data ?? {}) as DemoData;
    if (action === 'info') {
      return json({ enabled: !!cfg, intro: data.intro ?? '', profiles: Object.fromEntries(PROFILES.map((p) => [p, !!data[p]])) });
    }
    if (action !== 'login') return json({ error: 'Action inconnue' }, 400);
    if (!cfg) return json({ error: 'La démo est fermée pour le moment.' }, 403);
    if (!profile || !PROFILES.includes(profile) || !data[profile]) return json({ error: 'Profil non proposé dans la démo.' }, 400);
    const userId = data[profile]!;
    // Le profil professeur ne peut être que le professeur qui a ouvert la démo
    if (profile === 'prof' && userId !== cfg.teacher_id) return json({ error: 'Profil non autorisé.' }, 403);

    const { data: u, error: e1 } = await admin.auth.admin.getUserById(userId);
    if (e1 || !u.user?.email) return json({ error: 'Compte introuvable.' }, 404);
    // Lien de connexion généré sans envoi d'e-mail, puis utilisé tout de suite ici pour ouvrir la session
    const { data: link, error: e2 } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email });
    if (e2 || !link.properties?.hashed_token) return json({ error: 'Connexion impossible.' }, 500);
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
    const { data: v, error: e3 } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
    if (e3 || !v.session) return json({ error: 'Connexion impossible.' }, 500);

    // Identifiant de la session (dans le jeton) : noté comme session de démo, en lecture seule
    const claims = JSON.parse(atob(v.session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const { error: e4 } = await admin.from('demo_sessions').insert({ id: claims.session_id, user_id: userId, teacher_id: cfg.teacher_id, profile });
    if (e4) {
      // Sans cette marque, la session pourrait modifier les données : on la ferme
      await admin.auth.admin.signOut(v.session.access_token).catch(() => undefined);
      return json({ error: 'Connexion impossible.' }, 500);
    }
    return json({ access_token: v.session.access_token, refresh_token: v.session.refresh_token });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
