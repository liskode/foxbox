// Séances 0 « Prérequis » : une flashcard dont le point d'introduction est une de leurs séquences préalables
// y est ajoutée automatiquement, suspendue (le professeur la réactive s'il veut la faire réviser).
import { db, type Unit } from './db';

// Ajoute les flashcards aux séances 0 concernées ; renvoie les liens créés (pour « Annuler »)
export async function addToPrereqs(cards: { id: string; introUnitId?: string }[]): Promise<string[]> {
  const zeros = (await db.units.toArray()).filter((u) => u.prereqIds?.length);
  const ids = cards.flatMap((c) => (c.introUnitId ? zeros.filter((z) => z.prereqIds!.includes(c.introUnitId!)).map((z) => `${z.id}|${c.id}`) : []));
  const existing = new Set((await db.unitCards.bulkGet(ids)).filter(Boolean).map((l) => l!.id));
  const created = ids.filter((id) => !existing.has(id));
  await db.unitCards.bulkPut(created.map((id) => ({ id, unitId: id.split('|')[0], cardId: id.split('|')[1], suspended: true })));
  return created;
}

// Flashcards ajoutées à une séance : celles sans point d'introduction le prennent (la séquence de la séance),
// puis rejoignent, suspendues, les séances 0 des niveaux supérieurs
export async function introFromSeance(unit: Unit, cardIds: string[]) {
  if (unit.prereqIds?.length) return; // une séance 0 n'est pas un point d'introduction
  const seqId = unit.kind === 'sequence' ? unit.id : unit.parentId;
  if (!seqId) return;
  const cards = (await db.cards.bulkGet(cardIds)).filter((c) => c && !c.introUnitId);
  const now = Date.now();
  for (const c of cards) await db.cards.update(c!.id, { introUnitId: seqId, updatedAt: now });
  await addToPrereqs(cards.map((c) => ({ id: c!.id, introUnitId: seqId })));
}
