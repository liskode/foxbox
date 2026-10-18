// Thèmes des flashcards (léger : ne charge pas les outils d'import Anki)
export const THEMES: Record<string, string> = {
  '1': 'Matière',
  '2': 'Mouvement',
  '3': 'Énergie',
  '4': 'Signaux',
  '9': 'Outils mathématiques',
};
// Thèmes propres à chaque matière (le chiffre sert au code de la flashcard) ; les noms sont tous différents
export const THEMES_BY_SUBJECT: Record<string, Record<string, string>> = {
  'Physique-Chimie': THEMES,
  Mathématiques: {
    '1': 'Nombres',
    '2': 'Fonctions',
    '3': 'Statistiques',
    '4': 'Géométrie',
    '5': 'Algorithmique',
  },
};
export const themesOf = (subject?: string) => THEMES_BY_SUBJECT[subject ?? ''] ?? THEMES;
// Tous les thèmes, toutes matières confondues : nom → chiffre
export const ALL_THEMES: [string, string][] = Object.values(THEMES_BY_SUBJECT).flatMap((m) => Object.entries(m));
