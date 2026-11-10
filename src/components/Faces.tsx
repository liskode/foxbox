// Visages de l'autocorrection : 4 têtes de renard (ressenti global) et 4 visages par critère (0 · 40 · 80 · 100 %)
export const FEELINGS = ["Je n'ai pas du tout réussi", "Je n'ai plutôt pas réussi", "J'ai plutôt bien réussi", "J'ai très bien réussi"];
export const LEVEL_FACES = [
  { level: 0, label: 'Pas réussi', color: '#f6c9c3' },
  { level: 0.4, label: 'En partie', color: '#fcdcc0' },
  { level: 0.8, label: 'Réussi', color: '#cfece4' },
  { level: 1, label: 'Très bien réussi', color: '#9fd8b0' },
];

const INK = 'var(--ink, #222)';

// Tête de renard (images du dossier public/ressenti) : 0 pleure, 1 contrarié, 2 sourit, 3 très content
export function FoxFace({ mood, size = 64 }: { mood: number; size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}ressenti/renard-${mood}.png`} alt="" width={size} height={Math.round(size * 0.83)} style={{ objectFit: 'contain', display: 'block' }} />;
}

// Visage d'un critère : 0 triste, 1 moyen, 2 content, 3 étoile
export function LevelFace({ i, size = 28 }: { i: number; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <g stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {i === 3 ? (
          <path d="M16 3 L19.8 11.6 L29 12.4 L22 18.6 L24.1 27.8 L16 23 L7.9 27.8 L10 18.6 L3 12.4 L12.2 11.6 Z" fill="#ffd36b" />
        ) : (
          <>
            <circle cx="16" cy="16" r="13" fill="#fff" />
            <circle cx="11.5" cy="13" r="1.4" fill={INK} stroke="none" />
            <circle cx="20.5" cy="13" r="1.4" fill={INK} stroke="none" />
            {i === 0 && <path d="M10.5 22.5 Q16 17.5 21.5 22.5" />}
            {i === 1 && <path d="M11 21 L21 21" />}
            {i === 2 && <path d="M10.5 19 Q16 24.5 21.5 19" />}
          </>
        )}
      </g>
    </svg>
  );
}
