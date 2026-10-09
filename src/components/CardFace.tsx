import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';
import { db } from '../lib/db';
import { fetchMedia } from '../lib/sync';

const urlCache = new Map<string, string>();

// Une image gardée dans le navigateur peut devenir illisible (défaut connu de Safari avec IndexedDB) :
// on vérifie qu'elle se lit, sinon on la re-télécharge depuis le serveur.
async function readable(blob?: Blob) {
  if (!blob || !blob.size) return false;
  try {
    await blob.slice(0, 8).arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

export async function mediaUrl(id: string, force = false): Promise<string | null> {
  if (!force && urlCache.has(id)) return urlCache.get(id)!;
  const local = force ? undefined : (await db.media.get(id))?.blob;
  const blob = (await readable(local)) ? local! : await fetchMedia(id);
  if (!blob) return null;
  const old = urlCache.get(id);
  if (old) URL.revokeObjectURL(old);
  const u = URL.createObjectURL(blob);
  urlCache.set(id, u);
  return u;
}

async function resolve(html: string): Promise<string> {
  const ids = [...new Set([...html.matchAll(/src="media:([^"]+)"/g)].map((m) => m[1]))];
  let out = html;
  for (const id of ids) {
    const u = await mediaUrl(id);
    // data-mid : permet de recharger l'image si l'affichage échoue
    out = out.split(`src="media:${id}"`).join(`data-mid="${id}" src="${u ?? ''}"`);
  }
  return DOMPurify.sanitize(out, { ALLOWED_URI_REGEXP: /^(blob:|https?:|data:image\/)/i });
}

// Réessaie (jusqu'à 3 fois) les images absentes ou qui n'ont pas pu s'afficher
function repairImages(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>('img[data-mid]').forEach((img) => {
    const retry = async () => {
      const n = Number(img.dataset.tries ?? 0);
      if (n >= 3) return;
      img.dataset.tries = String(n + 1);
      await new Promise((r) => setTimeout(r, 400 * (n + 1)));
      const u = await mediaUrl(img.dataset.mid!, true);
      if (u) img.src = u;
      else retry();
    };
    img.onerror = retry;
    if (!img.getAttribute('src')) retry();
  });
}

export function CardFace({ html, full = false }: { html: string; full?: boolean }) {
  const [out, setOut] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    resolve(html).then((h) => alive && setOut(h));
    return () => {
      alive = false;
    };
  }, [html]);
  useEffect(() => {
    if (ref.current) repairImages(ref.current);
  }, [out]);
  useEffect(() => {
    if (ref.current && /\\\(|\\\[|\$\$/.test(out)) {
      renderMathInElement(ref.current, {
        delimiters: [
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '$$', right: '$$', display: true },
        ],
        throwOnError: false,
      });
    }
  }, [out]);
  return <div ref={ref} className={'cardface' + (full ? ' full' : '')} dangerouslySetInnerHTML={{ __html: out }} />;
}
