import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';
import { db } from '../lib/db';
import { fetchMedia } from '../lib/sync';

const urlCache = new Map<string, string>();

// Une image gardée dans le navigateur peut devenir illisible (défaut connu de Safari, surtout sur iPhone, avec IndexedDB).
// On en fait donc toujours une copie en mémoire (octets relus, type d'image reconnu) avant de l'afficher ;
// si la lecture échoue, l'image est re-téléchargée depuis le serveur.
function sniffType(b: Uint8Array, fallback: string) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  if (b[0] === 0x3c) return 'image/svg+xml';
  return fallback || 'application/octet-stream';
}
async function inMemory(blob?: Blob | null): Promise<Blob | null> {
  if (!blob || !blob.size) return null;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!bytes.length) return null;
    return new Blob([bytes], { type: sniffType(bytes, blob.type) });
  } catch {
    return null;
  }
}

// Lecture de la copie locale ; une lecture refusée (Safari) compte comme « pas de copie »
async function localBlob(id: string) {
  try {
    return (await db.media.get(id))?.blob;
  } catch {
    return undefined;
  }
}

export async function mediaUrl(id: string, force = false): Promise<string | null> {
  if (!force && urlCache.has(id)) return urlCache.get(id)!;
  // force (l'affichage a échoué) : on repart du serveur ; sinon de la copie locale, ou du serveur si elle est illisible
  const local = force ? null : await inMemory(await localBlob(id));
  const blob = local ?? (await inMemory(await fetchMedia(id).catch(() => null))) ?? (force ? await inMemory(await localBlob(id)) : null);
  if (!blob) return null;
  // L'ancienne adresse n'est pas libérée : d'autres vignettes peuvent encore l'afficher
  const u = URL.createObjectURL(blob);
  urlCache.set(id, u);
  return u;
}

async function resolve(html: string): Promise<string> {
  const ids = [...new Set([...html.matchAll(/src="media:([^"]+)"/g)].map((m) => m[1]))];
  // **mot** → gras
  let out = html.replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>');
  // Retours à la ligne tapés au clavier (sauf contenu HTML déjà mis en forme, ex. import Anki)
  if (!/<(br|div|p|li|tr)\b/i.test(out)) out = out.replace(/\n/g, '<br>');
  for (const id of ids) {
    const u = await mediaUrl(id);
    // data-mid : permet de recharger l'image si l'affichage échoue
    out = out.split(`src="media:${id}"`).join(`data-mid="${id}" src="${u ?? ''}"`);
  }
  // Liens et images : seulement blob:, http(s): et images en data: ; les autres valeurs (réglages des figures SVG :
  // viewBox, coordonnées, couleurs…) sont acceptées tant qu'elles ne ressemblent pas à une adresse d'un autre type
  return DOMPurify.sanitize(out, { ALLOWED_URI_REGEXP: /^(?:(?:blob|https?):|data:image\/|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i });
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
    if (ref.current && /\\\(|\\\[|\$/.test(out)) {
      renderMathInElement(ref.current, {
        delimiters: [
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }, // $E_c=\frac{1}{2}mv^2$
        ],
        throwOnError: false,
      });
    }
  }, [out]);
  return <div ref={ref} className={'cardface' + (full ? ' full' : '')} dangerouslySetInnerHTML={{ __html: out }} />;
}

// Texte libre (séances de soutien…) : retours à la ligne, **gras**, formules $…$ ; le HTML tapé n'est pas interprété
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function RichText({ text }: { text: string }) {
  const [out, setOut] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    resolve(escapeHtml(text)).then((h) => alive && setOut(h));
    return () => {
      alive = false;
    };
  }, [text]);
  useEffect(() => {
    if (ref.current && /\$/.test(out))
      renderMathInElement(ref.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
      });
  }, [out]);
  return <div ref={ref} className="richtext" dangerouslySetInnerHTML={{ __html: out }} />;
}
