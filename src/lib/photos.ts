// Photos des élèves : réduction de taille et association automatique par nom de fichier.
import { db, uid, type Student } from './db';
import { normalize } from './students';

// Réduit la photo (400 px max) pour limiter la place occupée.
export async function resizeImage(file: Blob, max = 400): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85));
}

export async function setPhoto(studentId: string, file: Blob, name = 'photo.jpg') {
  const student = await db.students.get(studentId);
  const id = uid();
  await db.media.put({ id, name, blob: await resizeImage(file) });
  await db.students.update(studentId, { photoId: id });
  if (student?.photoId) await db.media.delete(student.photoId);
}

export async function removePhoto(studentId: string) {
  const s = await db.students.get(studentId);
  if (s?.photoId) await db.media.delete(s.photoId);
  await db.students.update(studentId, { photoId: undefined });
}

const tokens = (s: string) =>
  s
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[\s._\-,]+/)
    .map(normalize)
    .filter(Boolean);

// Fichiers nommés « DUPONT Marie.jpg », « marie.dupont.png », « Dupont_Marie_4A.jpg »…
export function matchPhoto(fileName: string, students: Student[]): Student | undefined {
  const t = new Set(tokens(fileName));
  const hits = students.filter((s) => {
    const need = [...tokens(s.firstName), ...tokens(s.lastName)];
    return need.length > 0 && need.every((w) => t.has(w));
  });
  return hits.length === 1 ? hits[0] : undefined;
}

export async function importPhotos(files: File[], students: Student[]) {
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const f of files) {
    const s = matchPhoto(f.name, students);
    if (s) {
      await setPhoto(s.id, f, f.name);
      matched.push(s.id);
    } else unmatched.push(f.name);
  }
  return { matched: matched.length, unmatched };
}

// Avatar dessiné, utilisé pour les élèves fictifs de la démonstration.
export function demoAvatar(seed: number): Blob {
  seed = Math.floor(Math.abs(Math.sin(seed * 12.9898) * 43758.5453) * 1000) % 233280;
  const r = (n: number) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * n);
  };
  const skins = ['#f6d3b3', '#e8b48f', '#c98e66', '#9c6644', '#6f4a33', '#fde2c8'];
  const hairs = ['#2b1d14', '#5a3825', '#a5682a', '#e3c16f', '#1d1d1b', '#b5462f', '#7a7a7a'];
  const bgs = ['#f2be4e', '#b9b06c', '#ec8e83', '#e3a6b8', '#8dc9e3', '#7fcdbb', '#f4a261'];
  const skin = skins[r(skins.length)];
  const hair = hairs[r(hairs.length)];
  const bg = bgs[r(bgs.length)];
  const long = r(2) === 1;
  const glasses = r(4) === 0;
  const eyeY = 92 + r(6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" fill="${bg}"/>
${long ? `<rect x="48" y="60" width="104" height="120" rx="40" fill="${hair}"/>` : ''}
<rect x="62" y="150" width="76" height="60" rx="24" fill="${['#3d5a80', '#ee6c4d', '#293241', '#98c1d9', '#6a994e'][r(5)]}"/>
<ellipse cx="100" cy="100" rx="${40 + r(8)}" ry="${48 + r(6)}" fill="${skin}"/>
<path d="M${56 + r(6)} ${90 - r(10)} Q100 ${30 + r(16)} ${144 - r(6)} ${90 - r(10)} Q100 ${62 + r(10)} ${56 + r(6)} ${90 - r(10)}Z" fill="${hair}"/>
<circle cx="84" cy="${eyeY}" r="4.5" fill="#1d1d1b"/><circle cx="116" cy="${eyeY}" r="4.5" fill="#1d1d1b"/>
${glasses ? `<g fill="none" stroke="#1d1d1b" stroke-width="3"><circle cx="84" cy="${eyeY}" r="12"/><circle cx="116" cy="${eyeY}" r="12"/><path d="M96 ${eyeY}h8"/></g>` : ''}
<path d="M88 ${124 + r(4)} Q100 ${132 + r(6)} 112 ${124 + r(4)}" stroke="#1d1d1b" stroke-width="3" fill="none" stroke-linecap="round"/>
${r(3) === 0 ? `<circle cx="74" cy="114" r="6" fill="#e07a5f" opacity=".35"/><circle cx="126" cy="114" r="6" fill="#e07a5f" opacity=".35"/>` : ''}
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}
