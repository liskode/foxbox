// Codification des flashcards : niveau d'introduction + thème + origine + numéro, ex. 43MM-012
//  - niveau : 6, 5, 4, 3 (collège), 2, 1, 0 (Seconde, Première, Terminale), 9 = transversal / sans niveau
//  - thème : 1 Matière, 2 Mouvement, 3 Énergie, 4 Signaux (en 6e, thème 1 du cycle 3), 9 = transversal
//  - origine : 2 lettres (ER, MM…), voir Réglages
//  - numéro : 3 chiffres, compté pour chaque combinaison niveau + thème + origine
import { db, type Card } from './db';
import { THEMES } from './themes';

export const LEVEL_DIGIT: Record<string, string> = { '6e': '6', '5e': '5', '4e': '4', '3e': '3', '2nde': '2', '1re': '1', Tle: '0' };

export interface Origin {
  code: string; // 2 lettres
  name: string;
}
export const DEFAULT_ORIGINS: Origin[] = [{ code: 'ER', name: 'Etienne Renard' }];

export function themeDigit(level?: string, theme?: string) {
  const t = Object.entries(THEMES).find(([, v]) => v === theme)?.[0];
  if (!t || t === '9') return '9';
  return level === '6e' ? '1' : t; // en 6e, matière, mouvement, énergie et signaux forment le thème 1 du cycle 3
}

export const codePrefix = (c: Pick<Card, 'level' | 'theme' | 'origin'>) =>
  `${LEVEL_DIGIT[c.level ?? ''] ?? '9'}${themeDigit(c.level, c.theme)}${(c.origin || 'ER').toUpperCase()}`;

// Numéro suivant pour un préfixe (flashcards supprimées et anciens codes compris : un code n'est jamais réutilisé)
export async function nextCode(prefix: string, taken: string[] = []) {
  const all = [...(await db.cards.toArray()).flatMap((c) => [c.code, ...(c.aliases ?? [])]), ...taken];
  const n = Math.max(0, ...all.filter((c) => c.startsWith(prefix + '-')).map((c) => parseInt(c.slice(prefix.length + 1)) || 0));
  return `${prefix}-${String(n + 1).padStart(3, '0')}`;
}

export const cardCode = (c: Pick<Card, 'level' | 'theme' | 'origin'>) => nextCode(codePrefix(c));

// Origine utilisée par défaut pour une nouvelle flashcard (la dernière choisie sur cet ordinateur)
export function defaultOrigin() {
  try {
    return localStorage.getItem('foxbox-origin') || 'ER';
  } catch {
    return 'ER';
  }
}
export function rememberOrigin(code: string) {
  try {
    localStorage.setItem('foxbox-origin', code);
  } catch {
    /* navigation privée */
  }
}

export async function loadOrigins(teacherId: string): Promise<Origin[]> {
  return (await db.teachers.get(teacherId))?.origins ?? DEFAULT_ORIGINS;
}
