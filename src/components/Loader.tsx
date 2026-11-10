// Écran de chargement : le renard du logo, entouré par sa queue qui se trace en boucle
// (même dessin que dans index.html, affiché avant le démarrage de l'application).
import { useEffect, useRef, useState } from 'react';

const CX = 296;
const CY = 191;
const R = 134;
const START = 136; // départ : la touffe, en bas à gauche ; l'anneau se trace jusqu'au bout libre
const pt = (deg: number) => [CX + R * Math.cos((deg * Math.PI) / 180), CY + R * Math.sin((deg * Math.PI) / 180)];

// Partie de l'anneau encore cachée, pour une position k (0 → 1) dans la boucle
export function hiddenArc(k: number) {
  const grow = k < 0.82 ? 0.5 - 0.5 * Math.cos((k / 0.82) * Math.PI) : 1 - (k - 0.82) / 0.18;
  const left = (1 - grow) * 359.9;
  if (left < 0.5) return '';
  const [x0, y0] = pt(START - 360 + left);
  const [x1, y1] = pt(START - 360);
  return `M ${x0} ${y0} A ${R} ${R} 0 ${left > 180 ? 1 : 0} 0 ${x1} ${y1}`;
}

// delay : n'apparaît qu'après ce délai (évite un flash quand l'attente est très courte)
export function Loader({ text = 'Chargement de FoxBox…', delay = 300 }: { text?: string; delay?: number }) {
  const arc = useRef<SVGPathElement>(null);
  const [shown, setShown] = useState(delay === 0);
  useEffect(() => {
    if (shown) return;
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay, shown]);
  useEffect(() => {
    if (!shown) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return; // anneau complet, sans mouvement
    let id = 0;
    const loop = (t: number) => {
      arc.current?.setAttribute('d', hiddenArc((t % 2600) / 2600));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [shown]);
  if (!shown) return null;
  const base = import.meta.env.BASE_URL;
  return (
    <div className="loader-screen" role="status" aria-live="polite">
      <svg viewBox="20 20 456 470" width="200" aria-hidden="true">
        <defs>
          <mask id="loader-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="496" height="498">
            <rect width="496" height="498" fill="#fff" />
            <path ref={arc} fill="none" stroke="#000" strokeWidth="50" />
          </mask>
        </defs>
        <image href={`${base}queue-renard.png`} width="496" height="498" mask="url(#loader-mask)" />
        <image href={`${base}logo.png`} x="231" y="98" width="130" height="188" preserveAspectRatio="xMidYMid meet" />
      </svg>
      <span>{text}</span>
    </div>
  );
}
