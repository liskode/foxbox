// Couleurs de réussite de la grille de correction, réglables par le professeur :
//  - moyennes et notes globales : 6 couleurs, seuils en % (30 / 50 / 65 / 80 / 90 par défaut) ;
//  - case « un élève, un critère » : 4 catégories (1 2 3 4), seuils en % entre catégories.
export interface GradeColors {
  overall: { thresholds: number[]; colors: string[] }; // 5 seuils, 6 couleurs (de la plus faible à la meilleure)
  levels: { thresholds: number[]; colors: string[] }; // 3 seuils, 4 couleurs (catégories 1 à 4)
}

export const DEFAULT_GRADE_COLORS: GradeColors = {
  overall: {
    thresholds: [30, 50, 65, 80, 90],
    colors: ['#ef9a8f', '#f7cbc4', '#fcd7ad', '#fbeaa0', '#d3ecc6', '#9fd6ab'], // rouge, rouge clair, orange, jaune, vert clair, vert
  },
  levels: {
    thresholds: [20, 60, 90], // 0 % → 1 ; 40 % → 2 ; 80 % → 3 ; 100 % → 4
    colors: ['#f6c9c3', '#fcdcc0', '#cfece4', '#fbe7a1'], // rouge, orange, vert, jaune
  },
};

// Rang d'une valeur (0..1) parmi des seuils en % : 0 = sous le premier seuil
const rank = (v: number, thresholds: number[]) => thresholds.filter((t) => v * 100 >= t).length;

export const overallColor = (v: number | null | undefined, c: GradeColors = DEFAULT_GRADE_COLORS) =>
  v === null || v === undefined ? undefined : c.overall.colors[rank(v, c.overall.thresholds)];
export const levelCategory = (v: number, c: GradeColors = DEFAULT_GRADE_COLORS) => rank(v, c.levels.thresholds); // 0..3
export const levelCellColor = (v: number | null | undefined, c: GradeColors = DEFAULT_GRADE_COLORS) =>
  v === null || v === undefined ? undefined : c.levels.colors[levelCategory(v, c)];

// Couleur du texte posé sur une couleur réglable : noir sur fond clair, blanc sur fond foncé
// (celle des deux qui contraste le plus, d'après la luminance du fond)
export function inkOn(bg?: string): string | undefined {
  const m = bg?.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return undefined;
  const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  // contraste avec le noir (L+0.05)/0.05 contre le blanc 1.05/(L+0.05) : égalité vers L = 0.18
  return L > 0.18 ? 'var(--ink)' : '#fff';
}
