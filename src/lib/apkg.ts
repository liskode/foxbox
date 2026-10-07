// Import d'un paquet Anki (.apkg), formats ancien et récent (Anki 2.1.50+, compressé zstd).
import JSZip from 'jszip';
import { decompress } from 'fzstd';
import initSqlJs, { type Database } from 'sql.js';
import { db, uid, nextCardCode, type Card, type CardSnapshot } from './db';

export const THEMES: Record<string, string> = {
  '1': 'Matière',
  '2': 'Mouvement',
  '3': 'Énergie',
  '4': 'Signaux',
  '9': 'Outils mathématiques',
};

export interface ImportReport {
  importId: string;
  added: number;
  updated: number;
  skipped: { reason: string; preview: string }[];
  media: number;
}

const isZstd = (b: Uint8Array) => b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd;
const unz = (b: Uint8Array) => (isZstd(b) ? decompress(b) : b);

// Décodage minimal du protobuf MediaEntries { repeated MediaEntry { string name = 1; ... } = 1 }
function readVarint(b: Uint8Array, pos: number): [number, number] {
  let r = 0;
  let shift = 0;
  for (;;) {
    const byte = b[pos++];
    r += (byte & 0x7f) * 2 ** shift;
    if (byte < 0x80) return [r, pos];
    shift += 7;
  }
}

function parseMediaProto(b: Uint8Array): string[] {
  const names: string[] = [];
  let pos = 0;
  while (pos < b.length) {
    const [key, p1] = readVarint(b, pos);
    const [len, p2] = readVarint(b, p1);
    const entry = b.subarray(p2, p2 + len);
    pos = p2 + len;
    if (key >> 3 !== 1) continue;
    let q = 0;
    let name = '';
    while (q < entry.length) {
      const [k, q1] = readVarint(entry, q);
      const wt = k & 7;
      if (wt === 0) {
        q = readVarint(entry, q1)[1];
      } else if (wt === 2) {
        const [l, q2] = readVarint(entry, q1);
        if (k >> 3 === 1) name = new TextDecoder().decode(entry.subarray(q2, q2 + l));
        q = q2 + l;
      } else break;
    }
    names.push(name);
  }
  return names;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

function rows(sqldb: Database, sql: string): Record<string, unknown>[] {
  try {
    const res = sqldb.exec(sql)[0];
    if (!res) return [];
    return res.values.map((v) => Object.fromEntries(res.columns.map((c, i) => [c, v[i]])));
  } catch {
    return [];
  }
}

const strip = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export async function importApkg(
  file: File,
  subject: string,
  onProgress: (msg: string) => void,
): Promise<ImportReport> {
  onProgress('Ouverture du paquet…');
  const zip = await JSZip.loadAsync(file);
  const colFile = zip.file('collection.anki21b') ?? zip.file('collection.anki21') ?? zip.file('collection.anki2');
  if (!colFile) throw new Error("Ce fichier ne ressemble pas à un paquet Anki (.apkg).");
  const colBytes = unz(await colFile.async('uint8array'));

  const SQL = await initSqlJs({ locateFile: () => `${import.meta.env.BASE_URL}sql-wasm.wasm` });
  const sqldb = new SQL.Database(colBytes);

  // Types de notes à exclure (texte à trous, occlusion d'image)
  const excluded = new Set<string>();
  for (const r of rows(sqldb, 'select ntid, name from fields')) {
    if (String(r.name).toLowerCase() === 'occlusion') excluded.add(String(r.ntid));
  }

  const notes = rows(sqldb, 'select id, guid, mid, flds, tags from notes order by id');
  sqldb.close();
  // Les codes FoxBox suivent l'ordre de la codification d'origine quand elle existe
  const refOf = (n: Record<string, unknown>) => String(n.flds).match(/\d{3}FC\d{2}/i)?.[0] ?? '';
  notes.sort((a, b) => refOf(a).localeCompare(refOf(b)));

  // Table des médias : numéro dans le zip -> nom du fichier
  onProgress('Lecture des images…');
  const mediaFile = zip.file('media');
  let mediaNames: Record<string, string> = {};
  if (mediaFile) {
    const raw = unz(await mediaFile.async('uint8array'));
    const text = new TextDecoder().decode(raw.subarray(0, 1));
    if (text === '{') mediaNames = JSON.parse(new TextDecoder().decode(raw));
    else parseMediaProto(raw).forEach((n, i) => (mediaNames[String(i)] = n));
  }
  const byName = new Map(Object.entries(mediaNames).map(([idx, name]) => [name, idx]));

  const report: ImportReport = { importId: uid(), added: 0, updated: 0, skipped: [], media: 0 };
  const addedIds: string[] = [];
  const before: CardSnapshot[] = [];
  const mediaIds = new Map<string, string>(); // nom -> id FoxBox

  async function mediaFor(name: string): Promise<string | null> {
    if (mediaIds.has(name)) return mediaIds.get(name)!;
    const idx = byName.get(name);
    const f = idx !== undefined ? zip.file(idx) : null;
    if (!f) return null;
    const bytes = unz(await f.async('uint8array'));
    // Ré-import : une image identique déjà connue est réutilisée
    const same = (await db.media.where('name').equals(name).toArray()).find((m) => m.blob.size === bytes.length);
    if (same) {
      mediaIds.set(name, same.id);
      return same.id;
    }
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const id = uid();
    await db.media.put({ id, name, blob: new Blob([bytes], { type: MIME[ext] ?? 'application/octet-stream' }) });
    mediaIds.set(name, id);
    report.media++;
    return id;
  }

  async function convert(html: string): Promise<string> {
    const re = /<img([^>]*?)src=(["'])([^"']+)\2([^>]*)>/gi;
    let out = '';
    let last = 0;
    for (let m; (m = re.exec(html)); ) {
      out += html.slice(last, m.index);
      const id = await mediaFor(decodeURIComponent(m[3]));
      out += id ? `<img src="media:${id}">` : m[0];
      last = re.lastIndex;
    }
    return out + html.slice(last);
  }

  let i = 0;
  for (const n of notes) {
    i++;
    if (i % 10 === 0) onProgress(`Import des cartes… ${i}/${notes.length}`);
    const fields = String(n.flds).split('\x1f');
    const preview = strip(fields[0]).slice(0, 60) || fields[0].slice(0, 60);
    if (excluded.has(String(n.mid))) {
      report.skipped.push({ reason: "Occlusion d'image", preview });
      continue;
    }
    if (fields.some((f) => /\{\{c\d+::/.test(f))) {
      report.skipped.push({ reason: 'Texte à trous', preview });
      continue;
    }
    if (fields.length < 2) {
      report.skipped.push({ reason: 'Carte sans verso', preview });
      continue;
    }
    const front = await convert(fields[0]);
    const back = await convert(fields[1]);

    // Codification Physifox : niveau, thème, planche + FCnn
    const m = fields[0].match(/(\d)(\d)(\d)FC(\d{2})[QR]?/i);
    const sourceRef = m ? `${m[1]}${m[2]}${m[3]}FC${m[4]}` : undefined;
    const level = m ? `${m[1]}e` : undefined;
    const theme = m ? THEMES[m[2]] : undefined;
    const ankiTags = String(n.tags)
      .trim()
      .split(/\s+/)
      .filter((t) => t && !t.startsWith('AnkiHub_'));
    const tags = m ? [level!, ...(theme ? [theme] : [])] : ankiTags;

    const guid = String(n.guid);
    const existing = await db.cards.where('ankiGuid').equals(guid).first();
    const now = Date.now();
    if (existing) {
      const changed = existing.front !== front || existing.back !== back;
      if (changed || existing.deleted || existing.sourceRef !== (sourceRef ?? existing.sourceRef)) {
        const { id, front: f, back: b, sourceRef: sr, deleted, ocrDone, ocrFront, ocrBack } = existing;
        before.push({ id, front: f, back: b, sourceRef: sr, deleted, ocrDone, ocrFront, ocrBack });
      }
      await db.cards.update(existing.id, {
        front,
        back,
        sourceRef: sourceRef ?? existing.sourceRef,
        deleted: false,
        updatedAt: now,
        ...(changed ? { ocrDone: false } : {}),
      });
      report.updated++;
    } else {
      const card: Card = {
        id: uid(),
        code: await nextCardCode(),
        sourceRef,
        ankiGuid: guid,
        subject,
        level,
        theme,
        tags,
        front,
        back,
        createdAt: now,
        updatedAt: now,
      };
      await db.cards.put(card);
      addedIds.push(card.id);
      report.added++;
    }
  }
  await db.imports.put({
    id: report.importId,
    date: Date.now(),
    fileName: file.name,
    subject,
    added: addedIds,
    updated: report.updated,
    before,
    skipped: report.skipped.length,
  });
  return report;
}

// Annule un import : les cartes créées sont supprimées (l'historique des élèves est conservé),
// les cartes modifiées retrouvent leur contenu d'avant l'import.
export async function undoImport(importId: string) {
  const rec = await db.imports.get(importId);
  if (!rec || rec.undoneAt) return;
  const now = Date.now();
  for (const id of rec.added) await db.cards.update(id, { deleted: true, updatedAt: now });
  for (const snap of rec.before) await db.cards.update(snap.id, { ...snap, updatedAt: now });
  await db.imports.update(importId, { undoneAt: now });
}

// Nombre de révisions déjà faites par les élèves sur les cartes d'un import
export async function importReviewCount(importId: string) {
  const rec = await db.imports.get(importId);
  if (!rec) return 0;
  return db.reviews.where('cardId').anyOf([...rec.added, ...rec.before.map((b) => b.id)]).count();
}
