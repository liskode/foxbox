// Synchronisation entre la base locale (navigateur) et la base en ligne (Supabase).
// Toute écriture locale est notée dans `outbox` puis envoyée ; les changements des autres appareils
// sont récupérés périodiquement (curseur `updated_at` par table). Les règles d'accès de la base
// garantissent que chacun ne reçoit que ce qu'il a le droit de voir.
import Dexie, { type Transaction } from 'dexie';
import { db } from './db';
import { ONLINE, supabase } from './supabase';

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface TableSpec {
  remote: string;
  cols: (o: Obj) => Obj; // colonnes utilisées par les règles d'accès
  updateOnly?: boolean; // lignes créées uniquement côté serveur
}

let me: string | null = null;
export const setSyncUser = (id: string | null) => (me = id);

const SPECS: Record<string, TableSpec> = {
  teachers: { remote: 'teachers', cols: () => ({}), updateOnly: true },
  students: { remote: 'students', cols: () => ({}), updateOnly: true },
  groups: { remote: 'groups', cols: (g) => ({ teacher_ids: g.teacherIds }) },
  memberships: { remote: 'memberships', cols: (m) => ({ group_id: m.groupId, student_id: m.studentId }) },
  cards: { remote: 'cards', cols: (c) => ({ owner_id: c.ownerId ?? me }) },
  units: { remote: 'units', cols: (u) => ({ owner_id: u.ownerId ?? me }) },
  unitCards: { remote: 'unit_cards', cols: (u) => ({ owner_id: u.ownerId ?? me, unit_id: u.unitId, card_id: u.cardId }) },
  publications: { remote: 'publications', cols: (p) => ({ group_id: p.groupId }) },
  studentCards: { remote: 'student_cards', cols: (s) => ({ student_id: s.studentId }) },
  reviews: { remote: 'reviews', cols: (r) => ({ student_id: r.studentId }) },
  trombi: { remote: 'trombi', cols: (t) => ({ teacher_id: t.teacherId }) },
  imports: { remote: 'imports', cols: (i) => ({ owner_id: i.ownerId ?? me }) },
  notes: { remote: 'notes', cols: (n) => ({ teacher_id: n.teacherId, student_id: n.studentId }) },
  evaluations: { remote: 'evaluations', cols: (e) => ({ owner_id: e.ownerId ?? me }) },
  results: { remote: 'results', cols: (r) => ({ student_id: r.studentId }) },
  resultShares: { remote: 'result_shares', cols: (r) => ({ student_id: r.studentId }) },
  parentMessages: { remote: 'parent_messages', cols: (m) => ({ teacher_id: m.teacherId, student_id: m.studentId }) },
};

// ---------- Envoi ----------

type Listener = (s: SyncState) => void;
export interface SyncState {
  pending: number;
  syncing: boolean;
  error?: string;
  lastSync?: number;
}
let state: SyncState = { pending: 0, syncing: false };
const listeners = new Set<Listener>();
const emit = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
};
export function subscribeSync(l: Listener) {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

function enqueue(table: string, id: string, del: boolean) {
  if (!me) return; // aucune modification n'est notée hors session (ex. pendant la déconnexion)
  db.outbox.put({ key: `${table}|${id}`, table, id, del }).then(async () => {
    emit({ pending: await db.outbox.count() });
    schedulePush();
  });
}

let hooksInstalled = false;
function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  const watch = (name: string) => {
    const t = db.table(name);
    const note = (key: unknown, tx: Transaction, del: boolean) => {
      if ((tx as unknown as { __remote?: boolean }).__remote) return;
      tx.on('complete', () => enqueue(name, String(key), del));
    };
    t.hook('creating', function (key, obj, tx) {
      note(key ?? (obj as Obj).id, tx, false);
    });
    t.hook('updating', function (_mods, key, _obj, tx) {
      note(key, tx, false);
    });
    t.hook('deleting', function (key, _obj, tx) {
      note(key, tx, true);
    });
  };
  [...Object.keys(SPECS), 'media'].forEach(watch);
}

const bucketOf = (mediaId: string) => (mediaId.includes('/') ? 'photos' : 'cards');

let pushTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePush() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    push().catch((e) => emit({ error: String(e.message ?? e) }));
  }, 400);
}

let pushing = false;
export async function push() {
  if (!ONLINE || pushing || !me) return;
  pushing = true;
  try {
    for (;;) {
      const batch = await db.outbox.limit(200).toArray();
      if (!batch.length) break;
      const byTable = new Map<string, string[]>();
      const explicitDelete = new Set(batch.filter((b) => b.del).map((b) => b.key));
      batch.forEach((b) => byTable.set(b.table, [...(byTable.get(b.table) ?? []), b.id]));
      for (const [table, ids] of byTable) {
        if (table === 'media') {
          for (const id of ids) {
            const m = await db.media.get(id);
            const bucket = supabase.storage.from(bucketOf(id));
            if (!m && !explicitDelete.has(`media|${id}`)) continue;
            const { error } = m
              ? await bucket.upload(id, m.blob, { upsert: true, contentType: m.blob.type })
              : await bucket.remove([id]);
            if (error) throw error;
          }
        } else {
          const spec = SPECS[table];
          const objs = await db.table(table).bulkGet(ids);
          const rows = ids.map((id, i) => {
            const o = objs[i] as Obj | undefined;
            if (o) return { id, data: o, deleted: false, ...spec.cols(o) };
            // Absent de la copie locale : on ne supprime en ligne que sur demande explicite
            return explicitDelete.has(`${table}|${id}`) ? { id, deleted: true } : null;
          }).filter((r): r is NonNullable<typeof r> => r !== null);
          if (spec.updateOnly) {
            for (const r of rows) {
              const { error } = await supabase.from(spec.remote).update({ data: (r as Obj).data, deleted: r.deleted }).eq('id', r.id);
              if (error) throw error;
            }
          } else {
            const live = rows.filter((r) => !r.deleted);
            const dead = rows.filter((r) => r.deleted).map((r) => r.id);
            if (live.length) {
              const { error } = await supabase.from(spec.remote).upsert(live);
              if (error) throw error;
            }
            if (dead.length) {
              const { error } = await supabase.from(spec.remote).update({ deleted: true }).in('id', dead);
              if (error) throw error;
            }
          }
        }
        await db.outbox.bulkDelete(ids.map((id) => `${table}|${id}`));
      }
      emit({ pending: await db.outbox.count(), error: undefined });
    }
  } finally {
    pushing = false;
  }
}

// ---------- Réception ----------

async function pullTable(name: string, spec: TableSpec) {
  const cursorKey = `cursor:${name}`;
  let cursor = ((await db.meta.get(cursorKey))?.value as string | undefined) ?? '1970-01-01T00:00:00Z';
  for (;;) {
    const { data, error } = await supabase
      .from(spec.remote)
      .select('id, data, deleted, updated_at')
      .gt('updated_at', cursor)
      .order('updated_at')
      .limit(1000);
    if (error) throw error;
    if (!data.length) break;
    const pending = new Set((await db.outbox.where('key').startsWith(`${name}|`).toArray()).map((o) => o.id));
    await db.transaction('rw', db.table(name), db.meta, async () => {
      (Dexie.currentTransaction as unknown as { __remote: boolean }).__remote = true;
      const put = data.filter((r) => !r.deleted && !pending.has(r.id)).map((r) => r.data);
      const del = data.filter((r) => r.deleted && !pending.has(r.id)).map((r) => r.id);
      if (put.length) await db.table(name).bulkPut(put);
      if (del.length) await db.table(name).bulkDelete(del);
      cursor = data[data.length - 1].updated_at;
      await db.meta.put({ key: cursorKey, value: cursor });
    });
    if (data.length < 1000) break;
  }
}

export async function pull() {
  if (!ONLINE || !me) return;
  for (const [name, spec] of Object.entries(SPECS)) await pullTable(name, spec);
}

let running = false;
export async function syncNow() {
  if (!ONLINE || !me || running) return;
  running = true;
  emit({ syncing: true });
  try {
    await push();
    await pull();
    emit({ syncing: false, error: undefined, lastSync: Date.now(), pending: await db.outbox.count() });
  } catch (e) {
    emit({ syncing: false, error: String((e as Error).message ?? e) });
  } finally {
    running = false;
  }
}

// Téléchargement d'une image absente de la copie locale
export async function fetchMedia(id: string): Promise<Blob | null> {
  if (!ONLINE) return null;
  const { data, error } = await supabase.storage.from(bucketOf(id)).download(id);
  if (error || !data) return null;
  await db.transaction('rw', db.media, async () => {
    (Dexie.currentTransaction as unknown as { __remote: boolean }).__remote = true;
    await db.media.put({ id, name: id, blob: data });
  });
  return data;
}

let timer: ReturnType<typeof setInterval> | null = null;
export async function startSync(userId: string) {
  if (!ONLINE) return;
  setSyncUser(userId);
  installHooks();
  await syncNow();
  if (!timer) {
    timer = setInterval(syncNow, 60_000);
    window.addEventListener('focus', () => syncNow());
    window.addEventListener('online', () => syncNow());
  }
}

export async function stopSync() {
  if (timer) clearInterval(timer);
  timer = null;
  try {
    await push();
  } catch {
    /* hors ligne : les modifications non envoyées sont perdues à la déconnexion */
  }
  setSyncUser(null);
  // Un autre utilisateur peut se connecter sur cet appareil : on vide la copie locale.
  // Cet effacement est purement local : il ne doit surtout pas être envoyé en ligne comme une suppression.
  await db.transaction('rw', db.tables, async () => {
    (Dexie.currentTransaction as unknown as { __remote: boolean }).__remote = true;
    for (const t of db.tables) await t.clear();
  });
  await db.outbox.clear();
}

// Modifications locales qui reflètent une action déjà faite côté serveur : à ne pas renvoyer
export async function localOnly(tables: string[], fn: () => Promise<void>) {
  await db.transaction('rw', tables.map((t) => db.table(t)), async () => {
    (Dexie.currentTransaction as unknown as { __remote: boolean }).__remote = true;
    await fn();
  });
}
