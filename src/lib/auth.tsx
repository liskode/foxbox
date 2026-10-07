import { createContext, useContext, useState, type ReactNode } from 'react';
import { db } from './db';

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

const Ctx = createContext<{
  session: Session | null;
  login: (login: string, password: string) => Promise<Session | null>;
  logout: () => void;
}>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(load);

  async function login(login: string, password: string) {
    const l = login.trim().toLowerCase();
    const t = await db.teachers.where('login').equals(l).first();
    let s: Session | null = null;
    if (t && t.password === password) s = { role: 'prof', id: t.id };
    else {
      const st = await db.students.where('login').equals(l).first();
      if (st && st.password === password.trim()) s = { role: 'eleve', id: st.id };
    }
    if (s) {
      setSession(s);
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {
        /* navigation privée : la session ne survivra pas au rechargement */
      }
    }
    return s;
  }

  function logout() {
    setSession(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignoré */
    }
  }

  return <Ctx.Provider value={{ session, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
