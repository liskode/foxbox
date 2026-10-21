// Export des flashcards en paquet Anki (.apkg, format « collection.anki2 » lu par toutes les versions d'Anki).
// Deux organisations des sous-paquets :
//  - « niveau » : FoxBox › 4e › 3 Énergie › MM (Mme Mongkhonhsinh)
//  - « progression » : FoxBox › 4e › 431 La tension… › 4311 Définir… (flashcards sans séance : « Hors séquence »)
// Les identifiants (notes, paquets, modèle) sont stables : réimporter met à jour au lieu de dupliquer.
import { db, type Card, type Unit } from './db';
import { fetchMedia } from './sync';
import { ALL_THEMES } from './themes';
import { byProgression } from './units';
import type { Origin } from './cardCodes';
import { newlinesToBr } from './mathText';

export type ExportMode = 'niveau' | 'progression';

const ROOT = 'FoxBox';
const MODEL_ID = 1728000000001; // modèle « FoxBox » (Recto, Verso, Code), toujours le même
const LEVEL_ORDER = ['6e', '5e', '4e', '3e', '2nde', '1re', 'Tle'];

const clean = (s: string) => s.replace(/::/g, ':').replace(/["\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
const tagOf = (s: string) => s.trim().replace(/\s+/g, '_');
const strip = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Numéro positif stable (< 2^53) tiré d'un texte : identifiant de paquet ou de note
function hashId(s: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return (h1 % 2097151) * 4294967296 + h2 + 1000; // 21 + 32 bits
}

async function checksum(text: string) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text)));
  return ((d[0] << 24) >>> 0) + (d[1] << 16) + (d[2] << 8) + d[3];
}

// Niveau affiché dans les noms de paquets ; ordre des niveaux du collège au lycée
const levelName = (c: Card) => c.level || 'Transversal';
const levelRank = (l: string) => {
  const i = LEVEL_ORDER.indexOf(l);
  return i < 0 ? 9 : i;
};
function themeName(c: Card) {
  const digit = ALL_THEMES.find(([, v]) => v === c.theme)?.[0];
  return digit ? `${digit} ${c.theme}` : 'Sans thème';
}

// Texte FoxBox → HTML Anki : gras, retours à la ligne, formules ($…$ → \(…\)), images
function toAnki(html: string, media: Map<string, string>) {
  let out = html.replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>');
  if (!/<(br|div|p|li|tr)\b/i.test(out)) out = newlinesToBr(out);
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, '\\[$1\\]').replace(/(^|[^\\])\$([^$\n]+?)\$/g, '$1\\($2\\)');
  return out.replace(/src="media:([^"]+)"/g, (_, id: string) => `src="${media.get(id) ?? ''}"`);
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

export async function exportApkg(cards: Card[], mode: ExportMode, origins: Origin[], onProgress?: (msg: string) => void): Promise<{ blob: Blob; decks: number; missing: number }> {
  // Paquet de chaque flashcard
  const deckOf = new Map<string, string[]>();
  const extraTags = new Map<string, string[]>();
  const originName = (code?: string) => {
    const o = origins.find((x) => x.code === (code || 'ER').toUpperCase());
    return o ? `${o.code} (${o.name})` : (code || 'ER').toUpperCase();
  };
  if (mode === 'niveau') {
    for (const c of cards) deckOf.set(c.id, [levelName(c), themeName(c), originName(c.origin)]);
  } else {
    const units = await db.units.toArray();
    const byId = new Map(units.map((u) => [u.id, u]));
    const links = await db.unitCards.toArray();
    const unitsOf = new Map<string, Unit[]>();
    for (const l of links) {
      const u = byId.get(l.unitId);
      if (u) unitsOf.set(l.cardId, [...(unitsOf.get(l.cardId) ?? []), u]);
    }
    const seqOf = (u: Unit) => (u.kind === 'sequence' ? u : byId.get(u.parentId ?? ''));
    const label = (u: Unit) => (u.code ? `${u.code} ${u.name}` : u.name);
    for (const c of cards) {
      // Flashcard rattachée à plusieurs séances : rangée dans la première de la progression, les autres en tags
      const us = (unitsOf.get(c.id) ?? []).sort((a, b) => {
        const sa = seqOf(a);
        const sb = seqOf(b);
        return levelRank(sa?.level ?? '') - levelRank(sb?.level ?? '') || (sa && sb ? byProgression(sa, sb) : 0) || byProgression(a, b);
      });
      const u = us[0];
      const seq = u && seqOf(u);
      if (!u || !seq) deckOf.set(c.id, [levelName(c), 'Hors séquence']);
      else deckOf.set(c.id, u.kind === 'sequence' ? [seq.level || levelName(c), label(seq)] : [seq.level || levelName(c), label(seq), label(u)]);
      extraTags.set(c.id, us.map((x) => `seance_${x.code ?? tagOf(x.name)}`));
    }
  }

  // Paquets (avec leurs parents), dans l'ordre : niveaux du collège au lycée
  const deckNames = new Set<string>([ROOT]);
  const fullName = (path: string[]) => [ROOT, ...path.map(clean)].join('::');
  for (const path of deckOf.values()) for (let i = 1; i <= path.length; i++) deckNames.add(fullName(path.slice(0, i)));
  const now = Date.now();
  const sec = Math.floor(now / 1000);
  const deck = (id: number, name: string) => ({
    id, name, mod: sec, usn: -1, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0],
    collapsed: false, browserCollapsed: false, desc: name === ROOT ? 'Flashcards exportées depuis FoxBox' : '', dyn: 0, conf: 1, extendNew: 0, extendRev: 0,
  });
  const decks: Record<string, unknown> = { 1: deck(1, 'Default') };
  for (const n of deckNames) decks[hashId(n)] = deck(hashId(n), n);

  const model = {
    id: MODEL_ID, name: 'FoxBox', type: 0, mod: sec, usn: -1, sortf: 2, did: hashId(ROOT),
    tmpls: [{ name: 'Flashcard', ord: 0, qfmt: '{{Recto}}', afmt: '{{FrontSide}}<hr id=answer>{{Verso}}<div class="code">{{Code}}</div>', bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0 }],
    flds: ['Recto', 'Verso', 'Code'].map((name, ord) => ({ name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] })),
    css: '.card { font-family: Nunito, Arial, sans-serif; font-size: 20px; text-align: center; color: #1d1d1b; background: #fff; }\nimg { max-width: 100%; height: auto; }\n.code { margin-top: 14px; font-size: 12px; color: #999; }',
    latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
    latexPost: '\\end{document}', latexsvg: false, req: [[0, 'any', [0]]], tags: [], vers: [],
  };
  const dconf = {
    1: {
      id: 1, name: 'Default', replayq: true, timer: 0, maxTaken: 60, usn: 0, mod: 0, autoplay: true, dyn: false,
      lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
      rev: { perDay: 200, ease4: 1.3, fuzz: 0.05, minSpace: 1, ivlFct: 1, maxIvl: 36500, bury: false, hardFactor: 1.2 },
      new: { perDay: 20, delays: [1, 10], separate: true, ints: [1, 4, 7], initialFactor: 2500, bury: false, order: 1 },
    },
  };
  const conf = { nextPos: cards.length + 1, estTimes: true, activeDecks: [1], sortType: 'noteFld', timeLim: 0, sortBackwards: false, addToCur: true, curDeck: 1, newBury: true, newSpread: 0, dueCounts: true, curModel: String(MODEL_ID), collapseTime: 1200 };

  onProgress?.('Préparation du paquet…');
  const [{ default: initSqlJs }, { default: JSZip }] = await Promise.all([import('sql.js'), import('jszip')]);
  const SQL = await initSqlJs({ locateFile: () => `${import.meta.env.BASE_URL}sql-wasm.wasm` });
  const sdb = new SQL.Database();
  sdb.run(`
    CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
    CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
    CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
    CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor real not null, time integer not null, type integer not null);
    CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
    CREATE INDEX ix_notes_usn on notes (usn); CREATE INDEX ix_cards_usn on cards (usn); CREATE INDEX ix_revlog_usn on revlog (usn);
    CREATE INDEX ix_cards_nid on cards (nid); CREATE INDEX ix_cards_sched on cards (did, queue, due); CREATE INDEX ix_revlog_cid on revlog (cid); CREATE INDEX ix_notes_csum on notes (csum);
  `);
  sdb.run('INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)', [
    sec, now, now, JSON.stringify(conf), JSON.stringify({ [MODEL_ID]: model }), JSON.stringify(decks), JSON.stringify(dconf), '{}',
  ]);

  // Images : récupérées d'abord (copie locale, sinon serveur), nommées avec leur extension
  const zip = new JSZip();
  const media = new Map<string, string>(); // id FoxBox → nom du fichier dans Anki
  const index: Record<string, string> = {};
  const ids = [...new Set(cards.flatMap((c) => [...(c.front + c.back).matchAll(/src="media:([^"]+)"/g)].map((m) => m[1])))];
  let missing = 0;
  for (const [i, id] of ids.entries()) {
    onProgress?.(`Images : ${i + 1} / ${ids.length}`);
    let blob: Blob | null = null;
    try {
      const local = (await db.media.get(id))?.blob;
      blob = local && local.size ? new Blob([await local.arrayBuffer()], { type: local.type }) : await fetchMedia(id);
    } catch {
      blob = await fetchMedia(id).catch(() => null);
    }
    if (!blob) {
      missing++;
      continue;
    }
    const name = `foxbox_${id}.${EXT[blob.type] ?? 'png'}`;
    const n = String(Object.keys(index).length);
    index[n] = name;
    media.set(id, name);
    zip.file(n, await blob.arrayBuffer());
  }

  // Ordre : niveau, puis code de la flashcard
  const sorted = [...cards].sort((a, b) => levelRank(a.level ?? '') - levelRank(b.level ?? '') || a.code.localeCompare(b.code, 'fr', { numeric: true }));
  const usedIds = new Set<number>();
  let due = 1;
  for (const c of sorted) {
    const front = toAnki(c.front, media);
    const back = toAnki(c.back, media);
    const code = c.code + (c.sourceRef ? ` · ${c.sourceRef}` : '');
    let nid = hashId('note:' + c.id) % 1e13; // identifiant de note stable
    while (usedIds.has(nid)) nid++;
    usedIds.add(nid);
    const tags = [...new Set([...c.tags, c.code, c.level ? `niveau_${c.level}` : '', c.theme ?? '', c.origin ? `origine_${c.origin}` : '', ...(extraTags.get(c.id) ?? [])].filter(Boolean).map(tagOf))];
    const sfld = c.code;
    sdb.run('INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, "")', [
      nid, c.ankiGuid || c.id, MODEL_ID, sec, ` ${tags.join(' ')} `, [front, back, code].join('\x1f'), sfld, await checksum(strip(front) || sfld),
    ]);
    sdb.run('INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, "")', [nid, nid, hashId(fullName(deckOf.get(c.id)!)), sec, due++]);
  }
  const bytes = sdb.export();
  sdb.close();

  zip.file('collection.anki2', bytes);
  zip.file('media', JSON.stringify(index));
  onProgress?.('Compression…');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/octet-stream' });
  return { blob, decks: deckNames.size, missing };
}
