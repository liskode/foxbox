// Lecture d'un trombinoscope PDF exporté de l'ENT : une grille de photos avec « NOM Prénom » sous chacune.
// On repère chaque photo (position dans la page), on lit le texte placé juste dessous, puis on découpe la photo.
import type { Student } from './db';
import { normalize } from './students';

export interface Face {
  caption: string;
  blob: Blob;
  thumb: string; // URL d'aperçu
  match?: string; // id de l'élève reconnu
  firstName: string; // déduits de la légende (pour créer l'élève si besoin)
  lastName: string;
  truncated: boolean;
}

type Box = { x0: number; y0: number; x1: number; y1: number };

const mul = (a: number[], b: number[]) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

export async function readTrombiPdf(file: File, onProgress?: (msg: string) => void): Promise<Face[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const faces: Face[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(`Lecture de la page ${p}/${pdf.numPages}…`);
    const page = await pdf.getPage(p);
    const scale = 4; // rendu haute définition pour découper des photos nettes
    const vp = page.getViewport({ scale });

    // 1. Position des images : on suit les transformations jusqu'à chaque dessin d'image
    const ops = await page.getOperatorList();
    const OPS = pdfjs.OPS;
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    const boxes: Box[] = [];
    ops.fnArray.forEach((fn, i) => {
      const args = ops.argsArray[i];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.transform) ctm = mul(ctm, args as number[]);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const pts = [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ].map(([x, y]) => vp.convertToViewportPoint(ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]));
        const xs = pts.map((q) => q[0]);
        const ys = pts.map((q) => q[1]);
        const b = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
        // On ignore logos et petits éléments décoratifs
        if (b.x1 - b.x0 > 40 * scale && b.y1 - b.y0 > 40 * scale) boxes.push(b);
      }
    });
    if (!boxes.length) continue;

    // 2. Texte de la page, en coordonnées d'affichage
    const text = await page.getTextContent();
    const words = text.items
      .filter((it): it is typeof it & { str: string; transform: number[]; height: number } => 'str' in it && !!it.str.trim())
      .map((it) => {
        const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
        return { str: it.str, x, y }; // y = ligne de base du texte
      });

    // 3. Rendu de la page pour découper les photos
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    // intent « print » : le rendu ne dépend pas de l'affichage (fonctionne même si l'onglet passe en arrière-plan)
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp, intent: 'print' }).promise;

    const colStarts = [...new Set(boxes.map((b) => Math.round(b.x0)))].sort((a, b) => a - b);
    const rowStarts = [...new Set(boxes.map((b) => Math.round(b.y0)))].sort((a, b) => a - b);
    boxes.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

    for (const b of boxes) {
      const nextCol = colStarts.find((x) => x > b.x0 + 5) ?? vp.width;
      const nextRow = rowStarts.find((y) => y > b.y0 + 5) ?? vp.height;
      // Légende : sous la photo (elle peut mordre légèrement dessus), dans la colonne, avant la ligne suivante
      const lines = words
        .filter((w) => w.x >= b.x0 - 4 * scale && w.x < nextCol - 2 * scale && w.y > b.y1 - 10 * scale && w.y < Math.min(nextRow, b.y1 + 32 * scale))
        .sort((a, c) => a.y - c.y || a.x - c.x);
      const caption = lines
        .map((w) => w.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .replace(/(…|\.\.\.)\s+\p{Ll}$/u, '$1') // reste d'une 3e ligne coupée (« GARCI… i »)
        .trim();

      const crop = document.createElement('canvas');
      crop.width = Math.round(b.x1 - b.x0);
      crop.height = Math.round(b.y1 - b.y0);
      crop.getContext('2d')!.drawImage(canvas, b.x0, b.y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
      const blob = await new Promise<Blob>((res) => crop.toBlob((x) => res(x!), 'image/jpeg', 0.9));

      const { firstName, lastName, truncated } = splitCaption(caption);
      faces.push({ caption, blob, thumb: URL.createObjectURL(blob), firstName, lastName, truncated });
    }
  }
  return faces;
}

// « BOTELHO DE SOUSA Mathias » -> nom en majuscules, prénom ensuite. Un « … » signale un nom coupé.
export function splitCaption(caption: string) {
  const truncated = caption.includes('…') || caption.includes('...');
  const words = caption
    .replace(/…|\.\.\./g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 || /\p{Lu}/u.test(w));
  const isUpper = (w: string) => /\p{L}/u.test(w) && w === w.toUpperCase();
  const last = words.filter(isUpper);
  const first = words.filter((w) => !isUpper(w));
  const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
  return { lastName: title(last.join(' ')), firstName: first.join(' '), truncated };
}

const tokens = (s: string) =>
  s
    .replace(/…|\.\.\./g, ' ')
    .split(/[\s-]+/)
    .map(normalize)
    .filter((t) => t.length > 1);

// Chaque mot de la légende doit être le début d'un mot du nom de l'élève (les noms longs sont coupés).
export function matchFace(caption: string, students: Student[]): string | undefined {
  const cap = tokens(caption);
  if (!cap.length) return undefined;
  const scored = students
    .map((s) => {
      const st = tokens(`${s.firstName} ${s.lastName}`);
      const ok = cap.every((t) => st.some((w) => w.startsWith(t)));
      const exact = cap.filter((t) => st.includes(t)).length;
      return { s, ok, exact };
    })
    .filter((x) => x.ok)
    .sort((a, b) => b.exact - a.exact);
  if (!scored.length) return undefined;
  if (scored.length > 1 && scored[0].exact === scored[1].exact) return undefined; // ambigu
  return scored[0].s.id;
}
