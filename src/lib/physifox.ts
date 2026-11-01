// Physifox : site public. Les flashcards sont rattachées à des notions, et un chapitre regroupe des notions :
// changer de progression ou réorganiser un chapitre ne touche donc ni aux flashcards ni aux Decks des visiteurs.
import { db, uid, type Card, type CardDraft, type PfChapter, type PfDeckCard, type Rating } from './db';
import { INTERVALS, nextBox, DEFAULT_GOAL } from './leitner';
import { addDays, today } from './dates';
import { cardCode } from './cardCodes';
import { ONLINE } from './supabase';
import { pullPublic } from './sync';
import { SEED_CHAPTERS, SEED_DRAFTS, SEED_NOTIONS } from './physifoxSeed';

// Plan, notions et flashcards rédigées : ajoutés une seule fois, sans jamais écraser ce que le professeur a modifié
export async function ensureSeed(ownerId: string) {
  const missing = async <T extends { id: string }>(table: { bulkGet: (k: string[]) => Promise<(T | undefined)[]>; bulkPut: (o: T[]) => Promise<unknown> }, rows: T[]) => {
    const have = await table.bulkGet(rows.map((r) => r.id));
    const add = rows.filter((_, i) => !have[i]).map((r) => ({ ...r, ownerId }));
    if (add.length) await table.bulkPut(add);
  };
  await missing(db.pfNotions, SEED_NOTIONS);
  await missing(db.pfChapters, SEED_CHAPTERS);
  await missing(db.cardDrafts, SEED_DRAFTS);
}

// Démo locale : le plan existe dès la première visite. En ligne : lecture de ce qui est publié.
export async function loadPublic() {
  if (ONLINE) await pullPublic().catch((e) => console.warn('Physifox : lecture impossible', e));
  else if (!(await db.pfChapters.count())) await ensureSeed('local');
}

// Flashcards d'un chapitre
export async function chapterCardIds(ch: Pick<PfChapter, 'notionIds'>) {
  const links = await db.pfCardNotions.where('notionId').anyOf(ch.notionIds).toArray();
  return [...new Set(links.map((l) => l.cardId))];
}

export async function addChapterToDeck(visitorId: string, ch: PfChapter) {
  const ids = await chapterCardIds(ch);
  const have = await db.pfDeck.bulkGet(ids.map((id) => `${visitorId}|${id}`));
  const fresh: PfDeckCard[] = ids
    .filter((_, i) => !have[i])
    .map((cardId) => ({ id: `${visitorId}|${cardId}`, visitorId, cardId, chapterId: ch.id, box: 0, due: today(), reps: 0, lapses: 0, addedAt: Date.now() }));
  if (fresh.length) await db.pfDeck.bulkPut(fresh);
  return fresh.map((f) => f.id);
}

// Séance du jour : flashcards en retard d'abord, puis nouvelles, jusqu'à l'objectif quotidien
export async function deckSession(visitorId: string, extra = 0) {
  const day = today();
  const deck = await db.pfDeck.where('visitorId').equals(visitorId).toArray();
  const done = (await db.pfReviews.where('visitorId').equals(visitorId).toArray()).filter((r) => r.date === day).length;
  const due = deck.filter((d) => d.box > 0 && d.due <= day).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.box - b.box));
  const news = deck.filter((d) => d.box === 0).sort((a, b) => a.addedAt - b.addedAt);
  const pending = [...due, ...news];
  return { deck, done, goal: DEFAULT_GOAL, pending: pending.length, queue: pending.slice(0, Math.max(0, DEFAULT_GOAL - done + extra)).map((d) => d.cardId) };
}

// Même règle que la boîte en papier : une erreur renvoie en case 1
export async function recordDeckAnswer(visitorId: string, cardId: string, rating: Rating) {
  const day = today();
  const id = `${visitorId}|${cardId}`;
  const prev = await db.pfDeck.get(id);
  if (!prev) return;
  const boxAfter = nextBox(prev.box, rating, 'strict');
  await db.transaction('rw', db.pfDeck, db.pfReviews, async () => {
    await db.pfDeck.put({ ...prev, box: boxAfter, due: addDays(day, INTERVALS[boxAfter]), reps: prev.reps + 1, lapses: prev.lapses + (rating === 'forgot' ? 1 : 0), lastReview: day });
    await db.pfReviews.add({ id: uid(), visitorId, cardId, date: day, ts: Date.now(), rating, boxBefore: prev.box, boxAfter });
  });
}

export async function sendPfMessage(visitorId: string, authorId: string, text: string, cardId?: string) {
  const clean = text.trim().slice(0, 2000);
  if (!clean) return;
  await db.pfMessages.add({ id: uid(), visitorId, authorId, text: clean, createdAt: Date.now(), ...(cardId ? { cardId } : {}) });
}

// Validation : le brouillon (éventuellement corrigé) devient une vraie flashcard, rattachée à ses notions
export async function validateDraft(d: CardDraft, front: string, back: string) {
  const now = Date.now();
  const base = { level: d.level, theme: d.theme, origin: 'ER' };
  const card: Card = { id: uid(), code: await cardCode(base), ...base, sourceRef: d.id, subject: d.subject, tags: [], front, back, createdAt: now, updatedAt: now };
  await db.transaction('rw', db.cards, db.pfCardNotions, db.cardDrafts, async () => {
    await db.cards.put(card);
    await db.pfCardNotions.bulkPut(d.notionIds.map((notionId) => ({ id: `${notionId}|${card.id}`, notionId, cardId: card.id })));
    await db.cardDrafts.put({ ...d, front, back, status: 'validee', cardId: card.id, decidedAt: now });
  });
  return card;
}

export const setDraftStatus = (d: CardDraft, status: CardDraft['status']) => db.cardDrafts.put({ ...d, status, decidedAt: Date.now() });

// Texte des chapitres → HTML : le texte est d'abord échappé, seuls gras, listes et tableaux sont interprétés
export function proseHtml(text: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const out: string[] = [];
  let list: string[] = [];
  let table: string[][] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((l) => `<li>${l}</li>`).join('')}</ul>`);
    if (table.length) out.push(`<table>${table.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`);
    list = [];
    table = [];
  };
  for (const raw of esc(text).split('\n')) {
    const l = raw.trim();
    if (l.startsWith('- ')) list.push(l.slice(2));
    else if (l.startsWith('|')) table.push(l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    else {
      flush();
      if (l) out.push(`<p>${l}</p>`);
    }
  }
  flush();
  return out.join('');
}

// Statistiques pour l'onglet Physifox
export async function visitorStats() {
  const [visitors, deck, reviews] = await Promise.all([db.visitors.toArray(), db.pfDeck.toArray(), db.pfReviews.toArray()]);
  const weekAgo = addDays(today(), -7);
  const rows = visitors
    .map((v) => {
      const rs = reviews.filter((r) => r.visitorId === v.id);
      return {
        visitor: v,
        deck: deck.filter((d) => d.visitorId === v.id).length,
        reviews: rs.length,
        forgot: rs.filter((r) => r.rating === 'forgot').length,
        last: rs.reduce((m, r) => Math.max(m, r.ts), 0),
      };
    })
    .sort((a, b) => b.last - a.last || b.visitor.createdAt - a.visitor.createdAt);
  // Flashcards les plus ratées (au moins 3 réponses)
  const perCard = new Map<string, { n: number; forgot: number }>();
  for (const r of reviews) {
    const c = perCard.get(r.cardId) ?? { n: 0, forgot: 0 };
    c.n++;
    if (r.rating === 'forgot') c.forgot++;
    perCard.set(r.cardId, c);
  }
  const hard = [...perCard.entries()].filter(([, c]) => c.n >= 3).sort((a, b) => b[1].forgot / b[1].n - a[1].forgot / a[1].n).slice(0, 10);
  const cards = await db.cards.bulkGet(hard.map(([id]) => id));
  return {
    rows,
    total: visitors.length,
    active: new Set(reviews.filter((r) => r.date >= weekAgo).map((r) => r.visitorId)).size,
    reviews: reviews.length,
    hard: hard.map(([id, c], i) => ({ id, ...c, card: cards[i] })),
  };
}
