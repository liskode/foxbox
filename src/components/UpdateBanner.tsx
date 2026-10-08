// Prévient quand une nouvelle version du site a été publiée pendant que la page était ouverte.
import { useEffect, useState } from 'react';

const current = () => [...document.scripts].map((s) => s.src).find((s) => /\/assets\/index-[^/]+\.js$/.test(s));

export function isStaleVersionError(e: unknown) {
  return /module script|dynamically imported module|Importing a module|Failed to fetch/i.test(String((e as Error)?.message ?? e));
}

export function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const mine = current();
    if (!mine) return; // version de développement
    const check = async () => {
      try {
        // Paramètre unique : contourne aussi le cache du serveur de GitHub (jusqu'à 10 min)
        const html = await (await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' })).text();
        const latest = html.match(/assets\/index-[^"']+\.js/)?.[0];
        if (latest && !mine.endsWith(latest)) setStale(true);
      } catch {
        /* hors ligne */
      }
    };
    const timer = setInterval(check, 2 * 60_000);
    const onVisible = () => document.visibilityState === 'visible' && check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  if (!stale) return null;
  return (
    <div className="noprint" style={{ background: 'var(--outils)', borderBottom: 'var(--border)', padding: '8px 16px', textAlign: 'center', fontWeight: 700 }}>
      Une nouvelle version de FoxBox est disponible.{' '}
      <button className="btn small" onClick={() => location.reload()}>
        Recharger
      </button>
    </div>
  );
}
