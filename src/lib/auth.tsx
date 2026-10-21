import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { db } from './db';
import { ONLINE, supabase, loginToEmail, normalizeLogin } from './supabase';
import { startSync, stopSync } from './sync';
import { stopVisits } from './visits';
import { clearLocalData, isDemo, setDemoProfile, type DemoProfile } from './demoMode';

export interface Session {
  role: 'prof' | 'eleve' | 'parent';
  id: string;
}

const KEY = 'foxbox-session';

function load(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

function save(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* navigation privée : la session ne survivra pas au rechargement */
  }
}

const Ctx = createContext<{
  session: Session | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<Session | { error: string }>;
  demoLogin: (profile: DemoProfile) => Promise<Session | { error: string }>;
  logout: () => Promise<void>;
}>(null!);

// Rôle d'un compte en ligne : présent dans `teachers` ou dans `students`
async function roleOf(uid: string): Promise<Session | null> {
  const t = await supabase.from('teachers').select('id').eq('id', uid).maybeSingle();
  if (t.data) return { role: 'prof', id: uid };
  const s = await supabase.from('students').select('id').eq('id', uid).maybeSingle();
  if (s.data) return { role: 'eleve', id: uid };
  const p = await supabase.from('parents').select('id').eq('id', uid).maybeSingle();
  if (p.data) return { role: 'parent', id: uid };
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(ONLINE ? null : load);
  const [ready, setReady] = useState(!ONLINE);

  // En ligne : reprise de la session existante au chargement de la page
  useEffect(() => {
    if (!ONLINE) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      const s = uid ? (load()?.id === uid ? load() : await roleOf(uid)) : null;
      if (s) {
        await startSync(s.id);
        setSession(s);
      }
      setReady(true);
    })();
  }, []);

  async function login(login: string, password: string): Promise<Session | { error: string }> {
    if (ONLINE) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password: password.trim() });
      if (error) {
        return {
          error: /confirm/i.test(error.message)
            ? 'Adresse e-mail pas encore confirmée : cliquez sur le lien reçu par e-mail.'
            : login.includes('@')
              ? 'Adresse e-mail ou mot de passe incorrect.'
              : `Identifiant ou mot de passe incorrect. Élève : l'identifiant est de la forme prenom.nom (ici : « ${normalizeLogin(login)} »). Parent : l'identifiant est en général votre adresse e-mail.`,
        };
      }
      // Nouvelle connexion : rien d'une session précédente ne doit être envoyé au nom de ce compte
      await db.outbox.clear();
      if (isDemo()) {
        setDemoProfile(null);
        await clearLocalData();
      }
      const s = await roleOf(data.user.id);
      if (!s) {
        await supabase.auth.signOut();
        return { error: "Ce compte n'est pas encore autorisé dans FoxBox." };
      }
      await startSync(s.id);
      save(s);
      setSession(s);
      return s;
    }
    const l = login.trim().toLowerCase();
    const t = await db.teachers.where('login').equals(l).first();
    let s: Session | null = null;
    if (t && t.password === password) s = { role: 'prof', id: t.id };
    else {
      const st = await db.students.where('login').equals(l).first();
      if (st && st.password === password.trim()) s = { role: 'eleve', id: st.id };
      else {
        const pa = await db.parents.where('login').equals(l).first();
        if (pa && pa.password === password.trim()) s = { role: 'parent', id: pa.id };
      }
    }
    if (!s) return { error: 'Identifiant ou mot de passe incorrect.' };
    setSession(s);
    save(s);
    return s;
  }

  // Démo : session ouverte par le serveur sur le profil choisi, en lecture seule
  async function demoLogin(profile: DemoProfile): Promise<Session | { error: string }> {
    if (!ONLINE) return { error: 'Démo indisponible hors ligne.' };
    const { data, error } = await supabase.functions.invoke('demo', { body: { action: 'login', profile } });
    let msg = error?.message;
    if (error) {
      try {
        msg = (await (error as { context?: Response }).context?.json())?.error ?? msg;
      } catch {
        /* message brut */
      }
      return { error: msg ?? 'Connexion impossible.' };
    }
    // Une session déjà ouverte (compte réel ou autre profil de démo) est d'abord fermée
    stopVisits();
    await stopSync();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    setSession(null);
    save(null);
    await clearLocalData();
    setDemoProfile(profile);
    const { data: sd, error: e2 } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    const s = !e2 && sd.user ? await roleOf(sd.user.id) : null;
    if (!s) {
      setDemoProfile(null);
      await supabase.auth.signOut();
      return { error: 'Connexion impossible.' };
    }
    await startSync(s.id);
    save(s);
    setSession(s);
    return s;
  }

  async function logout() {
    stopVisits();
    if (ONLINE) {
      await stopSync();
      await supabase.auth.signOut();
    }
    setSession(null);
    save(null);
    // Sortie de la démo : rien du profil ne reste dans ce navigateur
    if (isDemo()) {
      setDemoProfile(null);
      await clearLocalData();
    }
  }

  return <Ctx.Provider value={{ session, ready, login, demoLogin, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

// Page d'accueil de chaque rôle
export const homeOf = (role: Session['role']) => (role === 'prof' ? '/prof' : role === 'parent' ? '/parent' : '/eleve');
