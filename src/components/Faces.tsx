// Visages de l'autocorrection : 4 têtes de renard (ressenti global) et 4 visages par critère (0 · 40 · 80 · 100 %)
export const FEELINGS = ["Je n'ai pas du tout réussi", "Je n'ai plutôt pas réussi", "J'ai plutôt bien réussi", "J'ai très bien réussi"];
export const LEVEL_FACES = [
  { level: 0, label: 'Pas réussi', color: '#f6c9c3' },
  { level: 0.4, label: 'En partie', color: '#fcdcc0' },
  { level: 0.8, label: 'Réussi', color: '#cfece4' },
  { level: 1, label: 'Très bien réussi', color: '#9fd8b0' },
];

const INK = 'var(--ink, #222)';

// Tête de renard au trait : 0 pleure, 1 contrarié, 2 sourit, 3 rit
export function FoxFace({ mood, size = 64 }: { mood: number; size?: number }) {
  const eyesOpen = mood === 1 || mood === 2;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <g stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
        <path d="M11 27 L9 5 L27 15 Z" fill="#f2a65a" />
        <path d="M53 27 L55 5 L37 15 Z" fill="#f2a65a" />
        <path d="M14 22 L13 11 L22 16" fill="none" strokeWidth={1.5} />
        <path d="M50 22 L51 11 L42 16" fill="none" strokeWidth={1.5} />
        <path d="M9 28 Q9 15 26 15 L38 15 Q55 15 55 28 Q55 42 32 59 Q9 42 9 28 Z" fill="#f2a65a" />
        <path d="M15 36 Q32 30 49 36 Q44 50 32 59 Q20 50 15 36 Z" fill="#fff4e6" />
        <ellipse cx="32" cy="43" rx="3.2" ry="2.4" fill={INK} />
        {eyesOpen && (
          <>
            <circle cx="23" cy="29" r="2.4" fill={INK} />
            <circle cx="41" cy="29" r="2.4" fill={INK} />
          </>
        )}
        {mood === 0 && (
          <>
            <path d="M19 27 L25 30 L19 32" fill="none" />
            <path d="M45 27 L39 30 L45 32" fill="none" />
            <ellipse cx="32" cy="51" rx="4" ry="4.5" fill="#7a2e2e" />
            <path d="M18 33 Q15 39 18 41 Q21 39 18 33 Z" fill="#7cc4ec" />
            <path d="M46 33 Q43 39 46 41 Q49 39 46 33 Z" fill="#7cc4ec" />
          </>
        )}
        {mood === 1 && (
          <>
            <path d="M19 24 L26 26" fill="none" />
            <path d="M45 24 L38 26" fill="none" />
            <path d="M26 52 Q32 47 38 52" fill="none" />
          </>
        )}
        {mood === 2 && <path d="M26 48 Q32 53 38 48" fill="none" />}
        {mood === 3 && (
          <>
            <path d="M19 30 Q23 25 27 30" fill="none" />
            <path d="M37 30 Q41 25 45 30" fill="none" />
            <path d="M24 47 Q32 47 40 47 Q38 56 32 56 Q26 56 24 47 Z" fill="#c9524f" />
          </>
        )}
      </g>
    </svg>
  );
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
