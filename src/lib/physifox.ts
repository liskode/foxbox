// Physifox : site public. Les flashcards sont rattachées à des notions, et un chapitre regroupe des notions :
// changer de progression ou réorganiser un chapitre ne touche donc ni aux flashcards ni aux Decks des visiteurs.
import { db, uid, type Card, type CardDraft, type PfChapter, type PfDeckCard, type Rating } from './db';
import { INTERVALS, nextBox, DEFAULT_GOAL } from './leitner';
import { addDays, today } from './dates';
import { cardCode } from './cardCodes';
import { ONLINE } from './supabase';
import { pullPublic } from './sync';
import { SEED_CHAPTERS, SEED_DRAFTS, SEED_NOTIONS } from './physifoxSeed';
import { SEED_LINKS } from './physifoxSeedCards';
import { SEED_FIGURES } from './physifoxSeedFigures';

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
  // Chapitre encore vide : il reçoit le texte rédigé depuis (un chapitre déjà commencé n'est jamais touché)
  for (const seed of SEED_CHAPTERS) {
    const c = await db.pfChapters.get(seed.id);
    if (c && !c.sections.length && c.status === 'a-faire' && seed.sections.length)
      await db.pfChapters.update(c.id, { sections: seed.sections, status: seed.status });
  }
  // Schémas : ajoutés une seule fois, sans toucher au texte (une figure retirée ensuite ne revient pas)
  for (const [id, bySection] of Object.entries(SEED_FIGURES)) {
    const c = await db.pfChapters.get(id);
    if (!c || c.figuresSeeded) continue;
    const sections = c.sections.map((s) => (bySection[s.id] && !s.figures?.length ? { ...s, figures: bySection[s.id] } : s));
    await db.pfChapters.update(id, { sections, figuresSeeded: true });
  }
  // Flashcards existantes : rattachées une seule fois par chapitre (un lien retiré ensuite ne revient pas)
  const todo = (await db.pfChapters.toArray()).filter((c) => !c.linksSeeded);
  if (todo.length) {
    const cards = await db.cards.where('code').anyOf(Object.keys(SEED_LINKS)).toArray();
    if (ONLINE && !cards.length) return; // flashcards pas encore reçues : ce sera pour la prochaine ouverture
    const wanted = new Set(todo.flatMap((c) => c.notionIds));
    await db.pfCardNotions.bulkPut(
      cards.flatMap((c) => SEED_LINKS[c.code].filter((n) => wanted.has(n)).map((notionId) => ({ id: `${notionId}|${c.id}`, notionId, cardId: c.id, ownerId }))),
    );
    await Promise.all(todo.map((c) => db.pfChapters.update(c.id, { linksSeeded: true })));
  }
  await placeCards();
}

// Mots utiles d'un texte, sans accents, balises ni pluriels
const STOP = new Set('dans pour avec cette quelle quel quels quelles comment est-ce sont elle elles leur leurs mais donc plus moins entre tout tous toute toutes chaque deux fait faire peut etre avoir aussi ainsi alors comme que qui quoi une des les aux par sur sous ses ces'.split(' '));
const wordsOf = (s: string) =>
  new Set(
    s.replace(/<[^>]+>/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g)?.map((w) => w.replace(/[sx]$/, '')).filter((w) => (w.length >= 4 || /\d/.test(w)) && !STOP.has(w)) ?? [],
  );

// Première répartition des flashcards d'un chapitre : chacune va sous la partie dont le texte lui ressemble le plus.
// Faite une seule fois ; celles sans partie évidente restent « à placer » pour le professeur.
async function placeCards() {
  const chapters = (await db.pfChapters.toArray()).filter((c) => c.linksSeeded && !c.cardsPlaced && c.sections.length);
  if (!chapters.length) return;
  const drafts = await db.cardDrafts.where('status').equals('attente').toArray();
  for (const c of chapters) {
    const sections = c.sections.filter((s) => s.kind !== 'exercice').map((s) => ({ id: s.id, title: wordsOf(s.title), body: wordsOf(s.body) }));
    const spread = (w: string) => sections.filter((s) => s.title.has(w) || s.body.has(w)).length;
    const links = await db.pfCardNotions.where('notionId').anyOf(c.notionIds).toArray();
    const cards = await db.cards.bulkGet([...new Set(links.map((l) => l.cardId))]);
    const items = [
      ...cards.flatMap((k) => (k && !k.deleted ? [{ id: k.id, text: `${k.front} ${k.back} ${k.ocrFront ?? ''} ${k.ocrBack ?? ''}` }] : [])),
      ...drafts.filter((d) => d.notionIds.some((n) => c.notionIds.includes(n))).map((d) => ({ id: d.id, text: `${d.front} ${d.back}` })),
    ];
    const placed = new Map<string, string[]>();
    for (const it of items) {
      const words = [...wordsOf(it.text)];
      let best = '';
      let top = 0.6; // en dessous, le rapprochement ne veut rien dire
      for (const s of sections) {
        const score = words.reduce((n, w) => n + ((s.title.has(w) ? 2 : s.body.has(w) ? 1 : 0) / (spread(w) || 1)), 0);
        if (score > top) [best, top] = [s.id, score];
      }
      if (best) placed.set(best, [...(placed.get(best) ?? []), it.id]);
    }
    await db.pfChapters.update(c.id, { sections: c.sections.map((s) => (placed.has(s.id) ? { ...s, cardIds: placed.get(s.id) } : s)), cardsPlaced: true });
  }
}

// Démo locale : le plan existe dès la première visite. En ligne : lecture de ce qui est publié.
export async function loadPublic() {
  if (ONLINE) await pullPublic().catch((e) => console.warn('Physifox : lecture impossible', e));
  else if (!(await db.pfChapters.count())) await ensureSeed('local');
}

// Flashcards d'un chapitre
export async function chapterCardIds(ch: Pick<PfChapter, 'notionIds'>) {
  const links = await db.pfCardNotions.where('notionId').anyOf(ch.notionIds).toArray();
  const ids = [...new Set(links.map((l) => l.cardId))];
  const cards = await db.cards.bulkGet(ids);
  return ids.filter((_, i) => !cards[i]?.deleted);
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
