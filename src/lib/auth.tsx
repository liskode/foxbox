import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { db } from './db';
import { ONLINE, supabase, loginToEmail, normalizeLogin } from './supabase';
import { startSync, stopSync } from './sync';

export interface Session {
  role: 'prof' | 'eleve';
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
  logout: () => Promise<void>;
}>(null!);

// Rôle d'un compte en ligne : présent dans `teachers` ou dans `students`
async function roleOf(uid: string): Promise<Session | null> {
  const t = await supabase.from('teachers').select('id').eq('id', uid).maybeSingle();
  if (t.data) return { role: 'prof', id: uid };
  const s = await supabase.from('students').select('id').eq('id', uid).maybeSingle();
  if (s.data) return { role: 'eleve', id: uid };
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
              : `Identifiant ou mot de passe incorrect. L'identifiant est de la forme prenom.nom (ici : « ${normalizeLogin(login)} »).`,
        };
      }
      // Nouvelle connexion : rien d'une session précédente ne doit être envoyé au nom de ce compte
      await db.outbox.clear();
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
    }
    if (!s) return { error: 'Identifiant ou mot de passe incorrect.' };
    setSession(s);
    save(s);
    return s;
  }

  async function logout() {
    if (ONLINE) {
      await stopSync();
      await supabase.auth.signOut();
    }
    setSession(null);
    save(null);
  }

  return <Ctx.Provider value={{ session, ready, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
