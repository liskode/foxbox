// Bandeau du bas des flashcards : couleur du niveau où la flashcard est introduite
// (niveau de sa séquence d'introduction, sinon son propre niveau), avec la matière et le thème en toutes lettres.
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Card } from './db';
import { DEFAULT_LEVEL_COLORS } from './units';
import { useAuth } from './auth';
import { ONLINE, supabase } from './supabase';

// Couleurs des niveaux du professeur : l'élève ne lit pas la fiche du professeur, il les demande au serveur
// une fois par ouverture de l'appli (gardées en mémoire pour le hors-ligne)
let asked = false;
async function colorsFor(role: string, id: string): Promise<Record<string, string>> {
  const own = (await db.teachers.get(id))?.levelColors ?? (role !== 'prof' ? (await db.teachers.toCollection().first())?.levelColors : undefined);
  if (own) return { ...DEFAULT_LEVEL_COLORS, ...own };
  if (role === 'eleve' && ONLINE && !asked) {
    asked = true;
    supabase.rpc('my_teacher_level_colors').then(({ data }) => data && db.meta.put({ key: 'levelColors', value: data }));
  }
  const kept = (await db.meta.get('levelColors'))?.value as Record<string, string> | undefined;
  return { ...DEFAULT_LEVEL_COLORS, ...(kept ?? {}) };
}

export function useCardBand() {
  const { session } = useAuth();
  const data = useLiveQuery(async () => {
    const seqLevel = new Map((await db.units.toArray()).filter((u) => u.kind === 'sequence').map((u) => [u.id, u.level]));
    return { seqLevel, colors: session ? await colorsFor(session.role, session.id) : DEFAULT_LEVEL_COLORS };
  }, [session?.id]);
  return (c: Card) => {
    const level = (c.introUnitId && data?.seqLevel.get(c.introUnitId)) || c.level;
    return {
      color: (level && data?.colors[level]) || 'var(--paper)',
      label: [c.subject, c.theme && c.theme !== c.subject ? c.theme : ''].filter(Boolean).join(' : '),
      level,
    };
  };
}
