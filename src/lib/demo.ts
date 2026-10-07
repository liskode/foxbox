// Données de démonstration : deux classes de 4e, des séquences, et 30 jours de révisions simulées.
import { db, uid, DEMO_TEACHER, type Group, type Review, type StudentCard, type Student, type Unit } from './db';
import { addDays, today } from './dates';
import { applyAnswer, buildQueue, DEFAULT_GOAL, type Available } from './leitner';
import { randomPassword, normalize } from './students';
import { demoAvatar } from './photos';

const FIRST = ['Emma', 'Lucas', 'Jade', 'Hugo', 'Léa', 'Louis', 'Chloé', 'Gabriel', 'Inès', 'Arthur', 'Manon', 'Jules',
  'Lina', 'Adam', 'Zoé', 'Nathan', 'Camille', 'Raphaël', 'Sarah', 'Tom', 'Alice', 'Noah', 'Lola', 'Ethan', 'Rose',
  'Sacha', 'Anna', 'Théo', 'Mila', 'Paul', 'Eva', 'Malo', 'Nina', 'Léon', 'Julia', 'Victor'];
const LAST = ['Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Moreau', 'Laurent',
  'Simon', 'Michel', 'Lefebvre', 'Leroy', 'Roux', 'David', 'Bertrand', 'Morel', 'Fournier', 'Girard', 'Bonnet',
  'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Lefèvre', 'Faure', 'Andre', 'Mercier', 'Blanc'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const SUBJECT = 'Physique-Chimie';

export async function hasDemo() {
  return !!(await db.meta.get('demo'));
}

export async function generateDemo() {
  const cards = (await db.cards.orderBy('code').toArray()).filter((c) => !c.deleted && c.subject === SUBJECT);
  if (!cards.length) throw new Error("Importez d'abord votre paquet Anki : la démonstration utilise vos cartes.");

  // Séquences : une par thème, avec une séance par planche d'origine
  const byTheme = new Map<string, typeof cards>();
  for (const c of cards) {
    const t = c.theme ?? 'Divers';
    if (!byTheme.has(t)) byTheme.set(t, []);
    byTheme.get(t)!.push(c);
  }
  const sequences: Unit[] = [];
  let order = 0;
  for (const [theme, list] of byTheme) {
    const seq: Unit = { id: uid(), kind: 'sequence', subject: SUBJECT, level: '4e', name: `${theme} (démo)`, order: order++ };
    sequences.push(seq);
    await db.units.put(seq);
    const byPlanche = new Map<string, typeof cards>();
    for (const c of list) {
      const k = c.sourceRef?.slice(0, 3) ?? 'x';
      if (!byPlanche.has(k)) byPlanche.set(k, []);
      byPlanche.get(k)!.push(c);
    }
    let o = 0;
    for (const [k, l] of byPlanche) {
      const se: Unit = { id: uid(), kind: 'seance', parentId: seq.id, subject: SUBJECT, name: `Séance ${++o} (planche ${k})`, order: o };
      await db.units.put(se);
      await db.unitCards.bulkPut(l.map((c) => ({ id: `${se.id}|${c.id}`, unitId: se.id, cardId: c.id })));
    }
  }

  const day = today();
  const groups: Group[] = [
    { id: uid(), name: '4e A', schoolYear: '2026-2027', subject: SUBJECT, teacherIds: [DEMO_TEACHER.id] },
    { id: uid(), name: '4e B', schoolYear: '2026-2027', subject: SUBJECT, teacherIds: [DEMO_TEACHER.id] },
  ];
  // La 4e A est un peu en avance sur la 4e B
  const pubOffsets = [[-30, -18, -8, -3], [-26, -12, -4]];
  const logins = new Set((await db.students.toArray()).map((s) => s.login));

  for (const [gi, g] of groups.entries()) {
    await db.groups.put(g);
    const pubs = pubOffsets[gi]
      .slice(0, sequences.length)
      .map((off, i) => ({ id: uid(), groupId: g.id, unitId: sequences[i].id, date: addDays(day, off) }));
    await db.publications.bulkPut(pubs);

    // Cartes disponibles par date de publication
    const avail: Available[] = [];
    for (const p of pubs) {
      const seances = await db.units.where('parentId').equals(p.unitId).primaryKeys();
      const links = await db.unitCards.where('unitId').anyOf(seances).toArray();
      for (const l of links) {
        const c = cards.find((x) => x.id === l.cardId)!;
        avail.push({ cardId: c.id, pubDate: p.date, order: parseInt(c.code.slice(1)) });
      }
    }
    const difficulty = new Map(cards.map((c) => [c.id, Math.random() ** 2]));

    for (let i = 0; i < 28; i++) {
      const firstName = pick(FIRST);
      const lastName = pick(LAST);
      let login = `${normalize(firstName)}.${normalize(lastName)}`;
      for (let n = 2; logins.has(login); n++) login = `${normalize(firstName)}.${normalize(lastName)}${n}`;
      logins.add(login);
      const s: Student = {
        id: uid(),
        firstName,
        lastName,
        login,
        password: randomPassword(),
        rule: 'strict',
        goals: { [SUBJECT]: pick([10, 15, 15, 20, 25]) },
        photoId: uid(),
      };
      await db.media.put({ id: s.photoId!, name: 'avatar.svg', blob: demoAvatar(gi * 100 + i + 1) });
      await db.students.put(s);
      await db.memberships.put({ id: `${g.id}|${s.id}`, groupId: g.id, studentId: s.id });

      const diligence = 0.15 + Math.random() * 0.8;
      const ability = 0.45 + Math.random() * 0.5;
      const scMap = new Map<string, StudentCard>();
      const reviews: Review[] = [];
      for (let off = -30; off <= -1; off++) {
        const d = addDays(day, off);
        if (Math.random() > diligence) continue;
        const open = avail.filter((a) => a.pubDate <= d);
        const queue = buildQueue(open, scMap, s.goals[SUBJECT] ?? DEFAULT_GOAL, d);
        for (const cardId of queue) {
          const prev = scMap.get(cardId);
          const p = ability * (1 - 0.6 * difficulty.get(cardId)!) + 0.05 * (prev?.box ?? 0);
          const r = Math.random();
          const rating = r > p ? 'forgot' : r < p * 0.65 ? 'easy' : 'hard';
          const { sc, review } = applyAnswer(s.id, cardId, SUBJECT, prev, rating, s.rule, d, Date.now());
          scMap.set(cardId, sc);
          reviews.push(review);
        }
      }
      await db.studentCards.bulkPut([...scMap.values()]);
      await db.reviews.bulkAdd(reviews);
    }
  }
  await db.meta.put({ key: 'demo', value: true });
}
