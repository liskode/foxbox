// Import de planches de flashcards en PDF (faites pour l'impression) : pages recto / verso alternées,
// grille de cartes séparées par des traits ; le verso est en miroir (impression recto-verso bord long).
import { db, uid, nextCardCode, type Card } from './db';

export interface Cell {
  blob: Blob;
  thumb: string;
  empty: boolean;
}
export interface Sheet {
  page: number; // numéro de la page recto
  rows: number;
  cols: number;
  front: Cell[]; // ordre : ligne par ligne
  back: Cell[];
}
export interface Planche {
  fileName: string;
  prefix: string; // ex. 6071FC
  level?: string; // ex. 6e (premier chiffre du nom de fichier)
  sheets: Sheet[];
}

// Repère les traits de la grille : lignes / colonnes majoritairement foncées
function gridLines(data: Uint8ClampedArray, W: number, H: number, vertical: boolean): number[] {
  const n = vertical ? W : H;
  const len = vertical ? H : W;
  const hits: number[] = [];
  for (let i = 0; i < n; i++) {
    let dark = 0;
    let total = 0;
    for (let j = 0; j < len; j += 7) {
      const x = vertical ? i : j;
      const y = vertical ? j : i;
      const k = (y * W + x) * 4;
      if (data[k] + data[k + 1] + data[k + 2] < 270) dark++;
      total++;
    }
    if (dark / total > 0.6) hits.push(i);
  }
  const groups: number[][] = [];
  for (const v of hits) {
    const g = groups[groups.length - 1];
    if (g && v - g[g.length - 1] <= 4) g.push(v);
    else groups.push([v]);
  }
  return groups.map((g) => Math.round((g[0] + g[g.length - 1]) / 2));
}

// Ajoute les bords de page si les traits extérieurs manquent, puis élimine les traits trop proches
function normalize(lines: number[], size: number): number[] {
  const out = [...lines];
  if (!out.length || out[0] > size * 0.05) out.unshift(0);
  if (out[out.length - 1] < size * 0.95) out.push(size - 1);
  return out.filter((v, i) => i === 0 || v - out[i - 1] > size * 0.08);
}

async function renderPage(page: import('pdfjs-dist').PDFPageProxy) {
  const base = page.getViewport({ scale: 1 });
  const scale = 2550 / base.width; // ≈ 300 ppp pour une page Lettre / A4
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp, intent: 'print' }).promise;
  return { canvas, ctx };
}

async function cut(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, xs: number[], ys: number[]): Promise<Cell[]> {
  const cells: Cell[] = [];
  for (let r = 0; r < ys.length - 1; r++) {
    for (let c = 0; c < xs.length - 1; c++) {
      const x0 = xs[c] + 4;
      const y0 = ys[r] + 4;
      const w = xs[c + 1] - xs[c] - 8;
      const h = ys[r + 1] - ys[r] - 8;
      // Case vide : presque aucun pixel non blanc à l'intérieur
      const img = ctx.getImageData(x0 + w * 0.05, y0 + h * 0.05, w * 0.9, h * 0.9).data;
      let ink = 0;
      for (let k = 0; k < img.length; k += 4 * 13) if (img[k] + img[k + 1] + img[k + 2] < 600) ink++;
      const empty = ink / (img.length / (4 * 13)) < 0.004;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      out.getContext('2d')!.drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
      const blob = await new Promise<Blob>((res) => out.toBlob((b) => res(b!), 'image/jpeg', 0.9));
      cells.push({ blob, thumb: URL.createObjectURL(blob), empty });
    }
  }
  return cells;
}

export async function readPlanche(file: File, onProgress?: (m: string) => void): Promise<Planche> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const prefix = file.name.replace(/\.pdf$/i, '').split(/\s+/)[0];
  const d = prefix.match(/^(\d)/)?.[1];
  const planche: Planche = { fileName: file.name, prefix, level: d && +d >= 3 && +d <= 6 ? `${d}e` : undefined, sheets: [] };
  for (let p = 1; p + 1 <= pdf.numPages; p += 2) {
    onProgress?.(`${file.name} : pages ${p} et ${p + 1}…`);
    const f = await renderPage(await pdf.getPage(p));
    const b = await renderPage(await pdf.getPage(p + 1));
    const W = f.canvas.width;
    const H = f.canvas.height;
    const data = f.ctx.getImageData(0, 0, W, H).data;
    const xs = normalize(gridLines(data, W, H, true), W);
    const ys = normalize(gridLines(data, W, H, false), H);
    const sheet: Sheet = {
      page: p,
      cols: xs.length - 1,
      rows: ys.length - 1,
      front: await cut(f.canvas, f.ctx, xs, ys),
      back: await cut(b.canvas, b.ctx, xs, ys),
    };
    planche.sheets.push(sheet);
  }
  return planche;
}

// Verso correspondant à la case recto i : même ligne, colonne miroir si le verso est retourné
export function backIndex(s: Sheet, i: number, mirrored: boolean) {
  const r = Math.floor(i / s.cols);
  const c = i % s.cols;
  return r * s.cols + (mirrored ? s.cols - 1 - c : c);
}

export interface PlanchePair {
  key: string; // identifiant stable (ré-import sans doublon)
  ref: string; // référence d'origine lisible
  front: Cell;
  back: Cell;
}

export function pairsOf(pl: Planche, mirrored: boolean): PlanchePair[] {
  const out: PlanchePair[] = [];
  let n = 0;
  for (const s of pl.sheets) {
    s.front.forEach((front, i) => {
      const back = s.back[backIndex(s, i, mirrored)];
      if (front.empty && back.empty) return;
      n++;
      out.push({ key: `pdf:${pl.prefix}:${s.page}:${i}`, ref: `${pl.prefix}-${String(n).padStart(2, '0')}`, front, back });
    });
  }
  return out;
}

export async function importPairs(pl: Planche, pairs: PlanchePair[], subject: string) {
  const now = Date.now();
  const added: string[] = [];
  let updated = 0;
  for (const p of pairs) {
    const fid = uid();
    const bid = uid();
    await db.media.put({ id: fid, name: `${p.ref}Q.jpg`, blob: p.front.blob });
    await db.media.put({ id: bid, name: `${p.ref}R.jpg`, blob: p.back.blob });
    const front = `<img src="media:${fid}">`;
    const back = `<img src="media:${bid}">`;
    const existing = await db.cards.where('ankiGuid').equals(p.key).first();
    if (existing) {
      await db.cards.update(existing.id, { front, back, deleted: false, ocrDone: false, updatedAt: now });
      updated++;
    } else {
      const card: Card = {
        id: uid(),
        code: await nextCardCode(),
        sourceRef: p.ref,
        ankiGuid: p.key,
        subject,
        level: pl.level,
        tags: pl.level ? [pl.level] : [],
        front,
        back,
        createdAt: now,
        updatedAt: now,
      };
      await db.cards.put(card);
      added.push(card.id);
    }
  }
  await db.imports.put({
    id: uid(),
    date: now,
    fileName: pl.fileName,
    subject,
    added,
    updated,
    before: [],
    skipped: 0,
  });
  return { added: added.length, updated };
}
