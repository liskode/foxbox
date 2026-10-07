import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';
import { db } from '../lib/db';

const urlCache = new Map<string, string>();

export async function mediaUrl(id: string): Promise<string | null> {
  if (urlCache.has(id)) return urlCache.get(id)!;
  const m = await db.media.get(id);
  if (!m) return null;
  const u = URL.createObjectURL(m.blob);
  urlCache.set(id, u);
  return u;
}

async function resolve(html: string): Promise<string> {
  const ids = [...html.matchAll(/src="media:([^"]+)"/g)].map((m) => m[1]);
  let out = html;
  for (const id of ids) {
    const u = await mediaUrl(id);
    if (u) out = out.split(`media:${id}`).join(u);
  }
  return DOMPurify.sanitize(out, { ALLOWED_URI_REGEXP: /^(blob:|https?:|data:image\/)/i });
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
