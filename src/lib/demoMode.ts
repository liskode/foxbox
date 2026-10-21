// Démo en lecture seule : session ouverte par le lien « Démo » sur un profil choisi par le professeur.
// Rien n'est envoyé au serveur (et le serveur refuse de toute façon les modifications de ces sessions).
import { db } from './db';

const KEY = 'foxbox-demo';
export type DemoProfile = 'prof' | 'eleve' | 'soutien' | 'parent';

export function demoProfile(): DemoProfile | null {
  try {
    return localStorage.getItem(KEY) as DemoProfile | null;
  } catch {
    return null;
  }
}
export const isDemo = () => !!demoProfile();
export function setDemoProfile(p: DemoProfile | null) {
  try {
    if (p) localStorage.setItem(KEY, p);
    else localStorage.removeItem(KEY);
  } catch {
    /* navigation privée */
  }
}
// Copie locale vidée en entrant et en sortant de la démo : les données du profil ne restent pas dans ce navigateur
export async function clearLocalData() {
  await Promise.all(db.tables.map((t) => t.clear()));
}
