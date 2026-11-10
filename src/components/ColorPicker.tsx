// Choix d'une couleur : une pastille qui ouvre la palette standard (couleurs vives, gris, puis 12 teintes du foncé au pâle).
import { useEffect, useRef, useState } from 'react';

const hex = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const VIVID = ['#ee4230', '#f39a32', '#fdfb56', '#74f84b', '#73fbfd', '#1937f5', '#ea53f7', '#7d2b8b', '#a0784a', '#ffffff', '#8e8e8e', '#000000'];
const GRAYS = Array.from({ length: 12 }, (_, i) => hex(0, 0, Math.round(100 - (i * 100) / 11)));
const HUES = [200, 222, 248, 272, 300, 342, 8, 24, 38, 50, 62, 90];
const LIGHTS = [16, 24, 32, 42, 52, 62, 72, 80, 87, 93];
const GRID = LIGHTS.map((l) => HUES.map((h) => hex(h, l > 85 ? 70 : 62, l)));

export const PALETTE = [VIVID, GRAYS, ...GRID];

export function ColorPicker({ value, onChange, size = 26, title }: { value?: string; onChange: (c: string) => void; size?: number; title?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  // La palette s'ouvre sous la pastille, recalée pour rester dans l'écran
  function toggle() {
    const r = ref.current!.getBoundingClientRect();
    const w = 312, h = 300;
    const top = r.bottom + 6 + h > innerHeight ? Math.max(8, r.top - 6 - h) : r.bottom + 6;
    setPos({ left: Math.max(8, Math.min(r.left, innerWidth - w - 8)), top });
    setOpen(!open);
  }
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    const hide = () => setOpen(false);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('scroll', hide, true);
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const cur = value?.toLowerCase();
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title={title ?? 'Choisir une couleur'}
        onClick={toggle}
        style={{ width: size, height: size, borderRadius: 6, background: value ?? 'var(--paper)', border: '1.5px solid #00000044', padding: 0, cursor: 'pointer', display: 'block' }}
      />
      {open && (
        <div className="panel pop" style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000, padding: 8, display: 'grid', gridTemplateColumns: 'repeat(12, 22px)', gap: 2 }}>
          {PALETTE.map((row, r) =>
            row.map((c) => (
              <button
                key={r + c}
                type="button"
                title={c}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                style={{
                  width: 22,
                  height: 22,
                  padding: 0,
                  background: c,
                  cursor: 'pointer',
                  borderRadius: 3,
                  border: cur === c ? '2.5px solid var(--ink)' : '1px solid #0000001f',
                  marginBottom: r < 2 ? 6 : 0,
                }}
              />
            )),
          )}
        </div>
      )}
    </span>
  );
}
