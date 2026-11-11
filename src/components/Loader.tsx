// Écran de chargement : le renard du logo, entouré par sa queue qui se trace en boucle
// (même dessin que dans index.html, affiché avant le démarrage de l'application).
import { useEffect, useRef, useState } from 'react';
import { PLUME, RING, SPINE } from './foxTail';

// Part encore cachée de la queue (1 → 0) pour une position k (0 → 1) dans la boucle :
// elle se trace depuis le bout du panache jusqu'au bout libre, puis se retire plus vite.
export function hiddenPart(k: number) {
  return k < 0.82 ? 0.5 + 0.5 * Math.cos((k / 0.82) * Math.PI) : (k - 0.82) / 0.18;
}

// delay : n'apparaît qu'après ce délai (évite un flash quand l'attente est très courte)
export function Loader({ text = 'Chargement de FoxBox…', delay = 300 }: { text?: string; delay?: number }) {
  const spine = useRef<SVGPathElement>(null);
  const [shown, setShown] = useState(delay === 0);
  useEffect(() => {
    if (shown) return;
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay, shown]);
  useEffect(() => {
    if (!shown) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return; // queue entière, sans mouvement
    let id = 0;
    const loop = (t: number) => {
      spine.current?.setAttribute('stroke-dashoffset', String(hiddenPart((t % 2600) / 2600)));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [shown]);
  if (!shown) return null;
  const base = import.meta.env.BASE_URL;
  return (
    <div className="loader-screen" role="status" aria-live="polite">
      <svg viewBox="30 40 410 450" width="200" aria-hidden="true">
        <defs>
          <mask id="loader-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="496" height="498">
            <path ref={spine} d={SPINE} pathLength={1} strokeDasharray="1 1" fill="none" stroke="#fff" strokeWidth="130" />
          </mask>
        </defs>
        <g mask="url(#loader-mask)" fill="#111">
          <path d={PLUME} fillRule="evenodd" />
          <path d={RING} />
        </g>
        <image href={`${base}logo.png`} x="231" y="98" width="130" height="188" preserveAspectRatio="xMidYMid meet" />
      </svg>
      <span>{text}</span>
    </div>
  );
}
