// Base de données locale (navigateur). Les tables reprennent le futur schéma Supabase
// pour que la migration se limite à remplacer ce fichier et les fonctions d'accès.
import Dexie, { type Table } from 'dexie';
import { ONLINE } from './supabase';

export type Rating = 'easy' | 'hard' | 'forgot';
export type Rule = 'strict' | 'douce';

export interface Card {
  id: string;
  code: string; // code unique FoxBox, ex. 43MM-012 (voir cardCodes.ts)
  sourceRef?: string; // référence d'origine, ex. 410FC01
  origin?: string; // origine (2 lettres : ER, MM…)
  aliases?: string[]; // anciens codes (restent trouvables par la recherche)
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
  levelColors?: Record<string, string>; // couleur de chaque niveau (6e, 5e, 4e, 3e)
  timetable?: import('./timetable').Timetable; // emploi du temps et calendrier A/B
  competences?: import('./competences').Competence[]; // référentiel de compétences
  rooms?: import('./rooms').Room[]; // salles (places cochées sur un quadrillage)
  modules?: { soutien?: boolean }; // modules activés dans les Réglages
  notifyEmail?: boolean; // e-mail à chaque nouveau message (adresse de connexion)
  tutorProfile?: TutorProfile; // soutien : coordonnées imprimées sur les relevés et attestations
  photoId?: string; // photo ou logo, à côté de ses messages
  relations?: import('./relations').Relation[]; // interlocuteurs de la famille (Mère M, Père P…)
  origins?: import('./cardCodes').Origin[]; // origines des flashcards (ER, MM…)
}

export interface Group {
  id: string;
  name: string;
  schoolYear: string;
  subject: string;
  teacherIds: string[];
  archived?: boolean;
  color?: string; // couleur de repérage (palette CLASS_COLORS)
  seatPlans?: import('./rooms').SeatPlan[]; // plans de classe
  subgroups?: Subgroup[]; // demi-groupes, îlots… (un élève est dans un seul sous-groupe)
  // Soutien scolaire : un « groupe de soutien » (un élève seul, ou 2-3 élèves) suivi dans une ou plusieurs matières
  kind?: 'soutien';
  tracks?: Track[]; // matières suivies et niveau de chacune
  unitStatus?: Record<string, UnitStatus>; // état des points du programme fixé à la main (sinon : « vu » s'il a été travaillé)
  teacherPhotoId?: string; // photo du professeur, recopiée pour l'élève et les parents (messages)
  timezone?: string; // fuseau horaire de l'élève (s'il vit ailleurs : Ottawa, Dallas…)
  relations?: import('./relations').Relation[]; // interlocuteurs et leurs codes, recopiés depuis les Réglages
}
export interface Track {
  subject: string;
  level: string;
}
export type UnitStatus = 'nonvu' | 'retravailler' | 'acquis';
// Une classe (et non un groupe de soutien)
export const isClass = (g?: Group | null) => !!g && g.kind !== 'soutien';
export const isTutoring = (g?: Group | null) => !!g && g.kind === 'soutien';

export interface Subgroup {
  id: string;
  name: string;
  color: string;
  studentIds: string[];
}
// Couleurs des sous-groupes (cerclage des photos)
export const SUBGROUP_COLORS = ['#e05a4f', '#3b82f6', '#16a34a', '#f59e0b', '#9333ea', '#0891b2', '#db2777', '#65a30d'];

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
  parentEmails?: string[];
  notifyEmail?: string; // adresse où l'élève veut être prévenu des nouveaux messages (facultatif)
}

// Compte parent (créé par le professeur depuis la fiche Famille), rattaché à un ou plusieurs enfants
export interface Parent {
  id: string;
  name: string; // Mère, Père… et prénom nom
  login: string; // adresse e-mail, ou identifiant parent.prenom.nom
  password: string;
  studentIds: string[];
  contactIds?: string[]; // contacts de la fiche Famille correspondants
  notifyEmail?: boolean; // e-mail à chaque nouveau message
}
export interface TutorProfile {
  name?: string; // nom affiché (sinon celui du compte)
  address?: string;
  siret?: string; // SIRET / n° de déclaration services à la personne
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
  code?: string; // niveau + thème + séquence (412) ; séance : code de la séquence + numéro (4121)
  theme?: string; // thème du programme, 1 à 4
  description?: string; // descriptif de la séance (professeur)
  documents?: { mediaId: string; name: string; size: number }[]; // PDF téléchargeables par les élèves
  duration?: number; // durée prévue en heures de cours (1 par défaut)
  isEval?: boolean; // séance d'évaluation (liée à une ou plusieurs évaluations, une par variante)
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
  flags?: StudentFlags; // aménagements (privés, comme la note)
  family?: { contacts: FamilyContact[]; notes?: string }; // coordonnées de la famille (privées)
  tutor?: TutorInfo; // soutien scolaire : établissement, classe, objectifs (privés)
  updatedAt: number;
}
export interface TutorInfo {
  school?: string;
  className?: string;
  goals?: string;
}
export interface FamilyContact {
  id: string;
  name: string; // lien avec l'élève : Mère, Père, tuteur…
  person?: string; // prénom et nom du parent
  email?: string;
  phone?: string;
}
export interface StudentFlags {
  tiersTemps?: boolean;
  ulis?: boolean;
  ordinateur?: boolean; // ordinateur en évaluation
}
// Absence relevée à l'appel (privée, comme les notes)
export interface Absence {
  id: string; // groupId|studentId|date
  teacherId: string;
  studentId: string;
  groupId: string;
  date: string; // AAAA-MM-JJ
  reason?: string; // motif (note libre)
  createdAt: number;
}
// Notes du professeur sur une classe (privées)
export interface ClassNote {
  id: string; // teacherId|groupId
  teacherId: string;
  groupId: string;
  text: string;
  updatedAt: number;
}

// ----- Correction des évaluations -----
export interface Criterion {
  id: string;
  label: string;
  points: number;
  cardIds?: string[]; // cartes FoxBox liées à ce critère
  competenceIds?: string[]; // compétences évaluées par ce critère (APP, ANA… ou sous-compétences)
}
export interface Evaluation {
  id: string;
  ownerId?: string;
  name: string;
  date: string; // AAAA-MM-JJ (date par défaut)
  groupDates?: Record<string, string>; // date propre à chaque classe
  subject: string;
  groupIds: string[];
  criteria: Criterion[];
  // Ce que voit l'élève dans son espace
  visibility: { note: boolean; appreciation: boolean; detail: boolean; competences?: boolean }; // competences : visible par défaut
  template?: boolean; // modèle réutilisable (sans classe)
  level?: string; // niveau (6e…3e)
  unitId?: string; // séance d'évaluation de la Progression (les variantes partagent la même séance)
  documents?: { mediaId: string; name: string; size: number }[]; // PDF : sujet, corrigé… (professeur)
  createdAt: number;
}
export interface Result {
  id: string; // evaluationId|studentId
  evaluationId: string;
  studentId: string;
  levels: Record<string, number | null>; // critère -> niveau 0..1 (null = non noté)
  absent?: boolean;
  appreciation?: string;
  cardsResetAt?: number;
  updatedAt: number;
}
// Version visible par l'élève (générée selon les réglages de l'évaluation)
export interface ResultShare {
  id: string;
  evaluationId: string;
  studentId: string;
  name: string;
  date: string;
  absent?: boolean;
  note?: number;
  total?: number;
  note20?: number;
  appreciation?: string;
  detail?: { label: string; points: number; level: number | null }[];
  competences?: { code: string; name: string; color: string; note: number; total: number }[]; // histogramme par compétence
}
export interface ParentMessage {
  id: string;
  teacherId: string;
  studentId: string;
  evaluationId?: string;
  date: string;
  kind?: 'mail' | 'tel' | 'entretien'; // mail par défaut (anciennes traces)
  to: string; // destinataire(s) ou interlocuteur
  subject: string;
  message: string;
}

// ----- Soutien scolaire -----
// Séance de soutien : visible par le professeur et les élèves du groupe
export interface TutoringSession {
  id: string;
  groupId: string;
  date: string; // AAAA-MM-JJ
  start?: string; // HH:MM, dans le fuseau `tz`
  tz?: string; // fuseau du professeur à la création (Europe/Paris si absent)
  duration: number; // minutes
  place: 'domicile' | 'en ligne';
  studentIds: string[]; // élèves présents
  unitIds: string[]; // points du programme travaillés (séquences ou séances de la progression, toutes matières)
  cardIds: string[]; // flashcards ajoutées pendant la séance
  done: string; // contenu de la séance (prévu à l'avance, puis ce qui a été fait)
  homework: string; // travail pour la prochaine fois
  links: { url: string; label: string }[];
  createdAt: number;
}
// Notes d'une séance, une par élève et par destinataire : l'élève ne lit que la sienne (« eleve »),
// les parents que la leur (« parents »), la note privée reste au professeur
export type SessionNoteKind = 'eleve' | 'parents' | 'prive';
export interface SessionNote {
  id: string; // sessionId|studentId|kind
  sessionId: string;
  groupId: string;
  teacherId: string;
  studentId: string;
  kind: SessionNoteKind;
  text: string;
  updatedAt: number;
}
// Document d'une séance, déposé par le professeur ou par un élève (sans séance : pour la prochaine)
export interface TutoringFile {
  id: string;
  groupId: string;
  sessionId?: string;
  mediaId: string; // « sout/<groupe>/<id> »
  name: string;
  size: number;
  type: string;
  authorId: string;
  byStudent: boolean;
  createdAt: number;
}
// Travail à faire coché par l'élève
export interface HomeworkCheck {
  id: string; // sessionId|studentId
  sessionId: string;
  groupId: string;
  studentId: string;
  done: boolean; // fait ou en grande partie
  status?: HomeworkStatus; // réponse de l'élève (sans : « fait » si done)
  at: number;
}
export type HomeworkStatus = 'fait' | 'partiel' | 'dur' | 'temps';

// Tarifs et mode de règlement d'un élève suivi en soutien (lus aussi par ses parents)
export type PayMode = 'seance' | 'forfait' | 'mois';
export interface Billing {
  id: string; // teacherId|studentId
  teacherId: string;
  studentId: string;
  rates: { from: string; hourly: number }[]; // tarif horaire et date d'effet
  mode: PayMode;
  currency?: string; // devise (EUR par défaut), propre à chaque élève
  issuer?: TutorProfile; // nom et coordonnées du professeur, pour le relevé vu par les parents
}
// Règlement reçu (lu aussi par les parents)
export interface Payment {
  id: string;
  teacherId: string;
  studentId: string;
  date: string;
  amount: number;
  method: string; // virement, chèque, espèces, CESU…
  label?: string; // ex. « Forfait 10 h »
  createdAt: number;
}
// Message d'un fil de discussion (fil « eleve » : élève ↔ professeur ; fil « parents » : parents ↔ professeur)
export type Thread = 'eleve' | 'parents';
export interface Message {
  id: string;
  teacherId: string;
  studentId: string;
  thread: Thread;
  authorId: string;
  authorName: string;
  text: string;
  attachments: { mediaId: string; name: string; size: number; type: string }[];
  recipients?: string[]; // destinataires (élève, parents) ; le professeur lit toute la conversation
  recipientNames?: Record<string, string>; // leurs noms, pour que chacun voie à qui le message est adressé
  editedAt?: number; // message corrigé après envoi
  createdAt: number;
}
export interface MessageRead {
  id: string; // userId|teacherId|studentId|thread
  userId: string;
  at: number; // date du dernier message lu
}

// Évaluation de l'élève dans son établissement (DS, contrôle), signalée par l'élève, un parent ou le professeur
export type AssessmentDocKind = 'programme' | 'sujet' | 'copie' | 'corrige' | 'autre';
export interface Assessment {
  id: string;
  studentId: string;
  authorId: string;
  date: string; // AAAA-MM-JJ
  subject: string;
  title: string; // « DS de mécanique »
  unitIds: string[]; // points du programme concernés
  program: string; // programme en texte libre
  documents: { mediaId: string; name: string; size: number; type: string; kind: AssessmentDocKind }[];
  score?: number;
  outOf?: number; // barème (20 par défaut)
  createdAt: number;
  updatedAt: number;
}

// Connexion d'un élève ou d'un parent (lue par les professeurs de l'élève)
export interface Visit {
  id: string;
  userId: string;
  role: 'eleve' | 'parent';
  name: string; // prénom de l'élève, ou « Mère – Claire … »
  studentIds: string[];
  start: number;
  last: number; // dernière activité : la durée est last − start
}

// To-do list personnelle du professeur
export interface Todo {
  id: string;
  teacherId: string;
  text: string;
  groupId?: string; // tâche liée à une classe
  due?: string; // échéance AAAA-MM-JJ
  done: boolean;
  doneAt?: number;
  createdAt: number;
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
  err?: string; // refusé par le serveur : mis de côté pour ne pas bloquer les autres envois
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
  classNotes!: Table<ClassNote, string>;
  absences!: Table<Absence, string>;
  imports!: Table<ImportRecord, string>;
  notes!: Table<Note, string>;
  evaluations!: Table<Evaluation, string>;
  results!: Table<Result, string>;
  resultShares!: Table<ResultShare, string>;
  parentMessages!: Table<ParentMessage, string>;
  todos!: Table<Todo, string>;
  meta!: Table<Meta, string>;
  trombi!: Table<TrombiCard, string>;
  tutoringSessions!: Table<TutoringSession, string>;
  sessionNotes!: Table<SessionNote, string>;
  tutoringFiles!: Table<TutoringFile, string>;
  homeworkChecks!: Table<HomeworkCheck, string>;
  parents!: Table<Parent, string>;
  billing!: Table<Billing, string>;
  payments!: Table<Payment, string>;
  messages!: Table<Message, string>;
  messageReads!: Table<MessageRead, string>;
  visits!: Table<Visit, string>;
  assessments!: Table<Assessment, string>;

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
    this.version(5).stores({
      evaluations: 'id, date',
      results: 'id, evaluationId, studentId',
      resultShares: 'id, studentId',
      parentMessages: 'id, studentId',
    });
    this.version(6).stores({ todos: 'id, groupId' });
    this.version(7).stores({ classNotes: 'id' });
    this.version(8).stores({ absences: 'id, studentId, groupId, date' });
    this.version(9).stores({
      tutoringSessions: 'id, groupId, date',
      sessionNotes: 'id, sessionId, studentId',
      tutoringFiles: 'id, groupId, sessionId',
      homeworkChecks: 'id, sessionId, studentId',
    });
    this.version(10).stores({
      parents: 'id, &login, *studentIds',
      billing: 'id, studentId',
      payments: 'id, studentId',
      messages: 'id, studentId, [studentId+thread]',
      messageReads: 'id',
    });
    this.version(11).stores({ visits: 'id, userId, *studentIds' });
    this.version(12).stores({ assessments: 'id, studentId, date' });
  }
}

export const db = new FoxBoxDB();

export const uid = () => crypto.randomUUID();

export const SUBJECTS = ['Physique-Chimie', 'SVT', 'Technologie', 'Mathématiques', 'BTS CPI'];

// Compte professeur de démonstration (à remplacer par Supabase Auth en production)
export const DEMO_TEACHER = { id: 'prof-demo', name: 'E. Renard', login: 'prof', password: 'foxbox' };

export async function ensureSeed() {
  if (!ONLINE && !(await db.teachers.get(DEMO_TEACHER.id))) await db.teachers.put(DEMO_TEACHER);
}


export async function resetAll() {
  await db.delete();
  location.reload();
}

// Copie réelle du contenu d'un fichier choisi par l'utilisateur. Safari ne garde sinon qu'une référence
// au fichier, qui devient vide plus tard (envoi refusé : « No content provided »).
export async function fileBlob(f: File): Promise<Blob> {
  return new Blob([await f.arrayBuffer()], { type: f.type || 'application/octet-stream' });
}

// Nom court d'une classe pour les pastilles : « 3C_2627 » → « 3C »
export const shortName = (name: string) => name.split('_')[0];
