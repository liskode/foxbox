// Connexion à la base en ligne. Sans configuration (fichier .env), FoxBox fonctionne en mode démo local.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const ONLINE = !!(url && key);
export const supabase: SupabaseClient = ONLINE ? createClient(url!, key!) : (null as unknown as SupabaseClient);

// Les élèves n'ont pas d'adresse e-mail : leur identifiant est converti en adresse technique.
export const STUDENT_DOMAIN = 'eleves.foxbox.app';
// « John Doe », « john doe » ou « Jöhn.Doe » donnent tous l'identifiant john.doe
export function normalizeLogin(login: string) {
  const clean = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = login.trim();
  if (t.includes('.')) return t.split('.').map(clean).join('.');
  // « Jean-Pierre Le Gall » -> jeanpierre.legall (prénom, puis nom en un seul mot, comme à la création)
  const [first, ...rest] = t.split(/[\s_]+/);
  return rest.length ? `${clean(first)}.${clean(rest.join(''))}` : clean(first);
}
export const loginToEmail = (login: string) =>
  login.includes('@') ? login.trim().toLowerCase() : `${normalizeLogin(login)}@${STUDENT_DOMAIN}`;

export async function callStudents<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('students', { body });
  if (error) {
    let msg = error.message;
    try {
      msg = (await (error as { context?: Response }).context?.json())?.error ?? msg;
    } catch {
      /* message par défaut */
    }
    throw new Error(msg);
  }
  return data as T;
}
