// Connexion à la base en ligne. Sans configuration (fichier .env), FoxBox fonctionne en mode démo local.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const ONLINE = !!(url && key);
export const supabase: SupabaseClient = ONLINE ? createClient(url!, key!) : (null as unknown as SupabaseClient);

// Les élèves n'ont pas d'adresse e-mail : leur identifiant est converti en adresse technique.
export const STUDENT_DOMAIN = 'eleves.foxbox.app';
export const loginToEmail = (login: string) =>
  login.includes('@') ? login.trim().toLowerCase() : `${login.trim().toLowerCase()}@${STUDENT_DOMAIN}`;

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
