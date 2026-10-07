import { useEffect, useRef } from 'react';
import { addDays, fromISO, today, frDate } from '../lib/dates';
import type { CardAgg } from '../lib/stats';

export const themeClass = (t?: string) => (t ? 't-' + t.split(' ')[0] : '');

export function ThemeChip({ theme }: { theme?: string }) {
  if (!theme) return null;
  return <span className={'chip ' + themeClass(theme)}>{theme}</span>;
}

export const themeColor = (t?: string) =>
  ({
    Matière: 'var(--matiere)',
    Mouvement: 'var(--mouvement)',
    Énergie: 'var(--energie)',
    Signaux: 'var(--signaux)',
    'Outils mathématiques': 'var(--outils)',
  })[t ?? ''] ?? 'var(--divers)';

const SHADES = ['#e9e5dc', '#c8eadf', '#95d6c3', '#5fbfa4', '#2f8f75'];

// Damier de régularité façon Anki : une colonne par semaine, du lundi au dimanche.
export function Heatmap({ counts, weeks = 20 }: { counts: Map<string, number>; weeks?: number }) {
  const end = today();
  const endDate = fromISO(end);
  const dow = (endDate.getDay() + 6) % 7; // lundi = 0
  const start = addDays(end, -dow - 7 * (weeks - 1));
  const max = Math.max(1, ...counts.values());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Sur petit écran, afficher d'abord les semaines les plus récentes
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, []);
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      const n = counts.get(day) ?? 0;
      const level = n === 0 ? 0 : Math.min(4, 1 + Math.floor((n / max) * 3.999));
      cells.push(
        <div
          key={d}
          className="cell"
          title={`${frDate(day)} : ${n} carte${n > 1 ? 's' : ''}`}
          style={{ background: day > end ? 'transparent' : SHADES[level] }}
        />,
      );
    }
    cols.push(
      <div key={w} className="col">
        {cells}
      </div>,
    );
  }
  return (
    <div>
      <div className="heatmap" ref={ref}>{cols}</div>
      <div className="legend">
        Moins {SHADES.map((c) => <div key={c} className="cell" style={{ width: 11, height: 11, borderRadius: 3, background: c }} />)} Plus
      </div>
    </div>
  );
}

export function Boxes({ dist }: { dist: number[] }) {
  const max = Math.max(1, ...dist);
  const labels = ['Nouv.', '1', '2', '3', '4', '5', '6', '7'];
  return (
    <div className="boxes">
      {dist.map((n, i) => (
        <div key={i} className="b" title={i === 0 ? 'Cartes jamais vues' : `Boîte ${i}`}>
          <div className="n">{n}</div>
          <div
            className="fill"
            style={{ height: `${(n / max) * 100}%`, background: i === 0 ? 'var(--divers)' : i < 3 ? 'var(--orange)' : 'var(--turquoise)' }}
          />
          <div className="lbl">{labels[i]}</div>
        </div>
      ))}
    </div>
  );
}

export function RateBar({ agg }: { agg?: CardAgg }) {
  if (!agg || !agg.total) return <span className="muted small">pas encore vue</span>;
  const p = (n: number) => `${(n / agg.total) * 100}%`;
  return (
    <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
      <div className="rate" title={`${agg.easy} facile · ${agg.hard} dur · ${agg.forgot} oubli`}>
        <span style={{ width: p(agg.easy), background: 'var(--easy)' }} />
        <span style={{ width: p(agg.hard), background: 'var(--hard)' }} />
        <span style={{ width: p(agg.forgot), background: 'var(--forgot)' }} />
      </div>
      <b style={{ whiteSpace: 'nowrap' }}>{Math.round(agg.success * 100)} %</b>
      <span className="muted small">({agg.total})</span>
    </div>
  );
}

export function Ring({ value, max, label }: { value: number; max: number; label: string }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, max ? value / max : 0);
  return (
    <div className="ring">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e9e5dc" strokeWidth="11" />
        {p > 0 && <circle
          cx="60" cy="60" r={r} fill="none" stroke={p >= 1 ? 'var(--easy)' : 'var(--orange)'} strokeWidth="11"
          strokeDasharray={`${c * p} ${c}`} strokeLinecap="round"
        />}
      </svg>
      <div className="center">
        <div style={{ fontSize: '1.6rem' }}>
          {value}/{max}
        </div>
        <div className="small muted" style={{ fontWeight: 700 }}>{label}</div>
      </div>
    </div>
  );
}

export function Pct({ v }: { v: number }) {
  return <>{Math.round(v * 100)} %</>;
}
