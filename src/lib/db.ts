// Base de données locale (navigateur). Les tables reprennent le futur schéma Supabase
// pour que la migration se limite à remplacer ce fichier et les fonctions d'accès.
import Dexie, { type Table } from 'dexie';
import { ONLINE, supabase } from './supabase';

export type Rating = 'easy' | 'hard' | 'forgot';
export type Rule = 'strict' | 'douce';

export interface Card {
  id: string;
  code: string; // code unique FoxBox, ex. C0042
  sourceRef?: string; // référence d'origine, ex. 410FC01
  ankiGuid?: string;
  subject: string;
  level?: string; // ex. "4e"
  theme?: string; // ex. "Matière"
  tags: string[];
  front: string; // HTML ; images référencées par src="media:ID"
  back: string;
  ocrFront?: string;
  ocrBack?: string;
  ocrDone?: boolean;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Media {
  id: string;
  name: string;
  blob: Blob;
}

export interface Teacher {
  id: string;
  name: string;
  login: string;
  password: string;
}

export interface Group {
  id: string;
  name: string;
  schoolYear: string;
  subject: string;
  teacherIds: string[];
  archived?: boolean;
  color?: string; // couleur de repérage (palette CLASS_COLORS)
}

// Couleurs de classe : déclinaisons claires de la charte physifox, lisibles avec du texte noir
// Ordre arc-en-ciel (du rose au violet), le neutre en dernier
export const CLASS_COLORS = [
  { name: 'Rose', value: '#f4d8e2' },
  { name: 'Saumon', value: '#f9d3cd' },
  { name: 'Orange', value: '#fcdcc0' },
  { name: 'Moutarde', value: '#fbe7b0' },
  { name: 'Kaki', value: '#e6e2bd' },
  { name: 'Pistache', value: '#dcedcf' },
  { name: 'Turquoise', value: '#cfece4' },
  { name: 'Ciel', value: '#d3eaf5' },
  { name: 'Lavande', value: '#e0dbf1' },
  { name: 'Sable', value: '#ece6d8' },
];

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  login: string;
  password: string;
  rule: Rule;
  goals: Record<string, number>; // objectif quotidien par matière
  photoId?: string; // media
}

// Espace Trombi : progression du professeur dans la mémorisation des élèves
export interface TrombiCard {
  id: string; // teacherId|studentId
  teacherId: string;
  studentId: string;
  box: number;
  due: string;
}

export interface Membership {
  id: string;
  groupId: string;
  studentId: string;
}

export interface Unit {
  id: string;
  kind: 'sequence' | 'seance';
  parentId?: string;
  subject: string;
  level?: string;
  name: string;
  order: number;
}

export interface UnitCard {
  id: string; // unitId|cardId
  unitId: string;
  cardId: string;
}

export interface Publication {
  id: string;
  groupId: string;
  unitId: string;
  date: string; // AAAA-MM-JJ
}

export interface StudentCard {
  id: string; // studentId|cardId
  studentId: string;
  cardId: string;
  box: number; // 0 = nouvelle, 1 à 7 = boîtes de Leitner
  due: string;
  reps: number;
  lapses: number;
  lastReview?: string;
}

export interface Review {
  id: string;
  studentId: string;
  cardId: string;
  subject: string;
  date: string;
  ts: number;
  rating: Rating;
  boxBefore: number;
  boxAfter: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

// Note privée d'un professeur sur un élève
export interface Note {
  id: string; // teacherId|studentId
  teacherId: string;
  studentId: string;
  text: string;
  updatedAt: number;
}

// Historique des imports Anki, pour pouvoir annuler un import
export interface CardSnapshot {
  id: string;
  front: string;
  back: string;
  sourceRef?: string;
  deleted?: boolean;
  ocrDone?: boolean;
  ocrFront?: string;
  ocrBack?: string;
}
export interface ImportRecord {
  id: string;
  date: number;
  fileName: string;
  subject: string;
  added: string[]; // cartes créées par cet import
  updated: number;
  before: CardSnapshot[]; // état des cartes existantes modifiées, avant l'import
  skipped: number;
  undoneAt?: number;
}

// Modifications locales en attente d'envoi vers la base en ligne
export interface Outbox {
  key: string; // table|id
  table: string;
  id: string;
  del?: boolean; // suppression explicite demandée par l'utilisateur
}

class FoxBoxDB extends Dexie {
  cards!: Table<Card, string>;
  media!: Table<Media, string>;
  teachers!: Table<Teacher, string>;
  groups!: Table<Group, string>;
  students!: Table<Student, string>;
  memberships!: Table<Membership, string>;
  units!: Table<Unit, string>;
  unitCards!: Table<UnitCard, string>;
  publications!: Table<Publication, string>;
  studentCards!: Table<StudentCard, string>;
  reviews!: Table<Review, string>;
  outbox!: Table<Outbox, string>;
  imports!: Table<ImportRecord, string>;
  notes!: Table<Note, string>;
  meta!: Table<Meta, string>;
  trombi!: Table<TrombiCard, string>;

  constructor() {
    super(ONLINE ? 'foxbox-online' : 'foxbox-v2');
    this.version(1).stores({
      cards: 'id, code, sourceRef, ankiGuid, subject, *tags',
      media: 'id',
      teachers: 'id, &login',
      groups: 'id',
      students: 'id, &login',
      memberships: 'id, groupId, studentId',
      units: 'id, parentId, subject',
      unitCards: 'id, unitId, cardId',
      publications: 'id, groupId, unitId',
      studentCards: 'id, studentId, cardId',
      reviews: 'id, studentId, cardId, date, [studentId+date]',
      meta: 'key',
      trombi: 'id, teacherId',
      outbox: 'key',
    });
    this.version(2).stores({ media: 'id, name' });
    this.version(3).stores({ imports: 'id, date' });
    this.version(4).stores({ notes: 'id, studentId' });
  }
}

export const db = new FoxBoxDB();

export const uid = () => crypto.randomUUID();

export const SUBJECTS = ['Physique-Chimie', 'SVT', 'Technologie', 'Mathématiques'];

// Compte professeur de démonstration (à remplacer par Supabase Auth en production)
export const DEMO_TEACHER = { id: 'prof-demo', name: 'E. Renard', login: 'prof', password: 'foxbox' };

export async function ensureSeed() {
  if (!ONLINE && !(await db.teachers.get(DEMO_TEACHER.id))) await db.teachers.put(DEMO_TEACHER);
}

export async function nextCardCode(): Promise<string> {
  if (ONLINE) {
    const { data, error } = await supabase.rpc('next_card_code');
    if (error) throw error;
    return data as string;
  }
  const m = await db.meta.get('cardCounter');
  const n = ((m?.value as number) ?? 0) + 1;
  await db.meta.put({ key: 'cardCounter', value: n });
  return 'C' + String(n).padStart(4, '0');
}

export async function resetAll() {
  await db.delete();
  location.reload();
}
