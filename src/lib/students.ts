// Comptes élèves : génération des identifiants et import CSV.
import { db, uid, type Student } from './db';
import { DEFAULT_GOAL } from './leitner';
import { ONLINE, callStudents } from './supabase';
import { syncNow, localOnly } from './sync';

const WORDS = [
  'atome', 'photon', 'neutron', 'proton', 'renard', 'comete', 'orbite', 'quartz', 'cristal', 'dipole',
  'ampere', 'newton', 'joule', 'plasma', 'nuage', 'galaxie', 'meteore', 'aimant', 'prisme', 'laser',
];

export function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function randomPassword() {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  return w + String(Math.floor(Math.random() * 90) + 10);
}

async function uniqueLogin(first: string, last: string) {
  const base = [normalize(first), normalize(last)].filter(Boolean).join('.') || 'eleve';
  let login = base;
  for (let n = 2; await db.students.where('login').equals(login).count(); n++) login = base + n;
  return login;
}

export async function createStudent(firstName: string, lastName: string): Promise<Student> {
  const s: Student = {
    id: uid(),
    firstName,
    lastName,
    login: await uniqueLogin(firstName, lastName),
    password: randomPassword(),
    rule: 'strict',
    goals: {},
  };
  await db.students.put(s);
  return s;
}

export async function addToGroup(studentId: string, groupId: string, subject: string) {
  await db.memberships.put({ id: `${groupId}|${studentId}`, groupId, studentId });
  const s = await db.students.get(studentId);
  if (s && s.goals[subject] === undefined) {
    await db.students.update(studentId, { goals: { ...s.goals, [subject]: DEFAULT_GOAL } });
  }
}

export interface ParsedRow {
  firstName: string;
  lastName: string;
  className?: string;
}

const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());

// Accepte : « Nom;Prénom;Classe », « Prénom,Nom », ou une colonne « Élève » au format
// Pronote « NOM Prénom ». Séparateur ; , ou tabulation détecté automatiquement.
export function parseCsv(text: string): ParsedRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = [';', '\t', ','].find((s) => lines[0].includes(s)) ?? ';';
  const split = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
  const header = split(lines[0]).map(normalize);
  const idx = (...names: string[]) => header.findIndex((h) => names.includes(h));
  let iNom = idx('nom', 'lastname', 'nomdefamille');
  let iPrenom = idx('prenom', 'firstname', 'prenoms');
  const iEleve = idx('eleve', 'eleves', 'nomprenom');
  const iClasse = idx('classe', 'class', 'division');
  const hasHeader = iNom >= 0 || iPrenom >= 0 || iEleve >= 0;
  const body = hasHeader ? lines.slice(1) : lines;
  if (!hasHeader) {
    iNom = 0;
    iPrenom = 1;
  }
  const out: ParsedRow[] = [];
  for (const l of body) {
    const c = split(l);
    let firstName = '';
    let lastName = '';
    if (iEleve >= 0 && iNom < 0) {
      const words = c[iEleve].split(/\s+/);
      const upper = words.filter((w) => w === w.toUpperCase() && /\p{L}/u.test(w));
      lastName = title(upper.join(' '));
      firstName = words.filter((w) => !upper.includes(w)).join(' ');
    } else {
      lastName = title(c[iNom] ?? '');
      firstName = c[iPrenom] ?? '';
    }
    if (!firstName && !lastName) continue;
    out.push({ firstName: title(firstName), lastName, className: iClasse >= 0 ? c[iClasse] : undefined });
  }
  return out;
}

// Un élève déjà connu (même prénom et nom) est réutilisé : pas de doublon d'une année sur l'autre.
export async function importStudents(rows: ParsedRow[], groupId: string, subject: string) {
  if (ONLINE) {
    // Comptes créés par la fonction serveur (seule autorisée à créer des identifiants)
    const r = await callStudents<{ created: number; reused: number }>({
      action: 'create',
      groupId,
      students: rows.map(({ firstName, lastName }) => ({ firstName, lastName })),
    });
    await syncNow();
    return r;
  }
  let created = 0;
  let reused = 0;
  const all = await db.students.toArray();
  for (const r of rows) {
    const found = all.find(
      (s) => normalize(s.firstName) === normalize(r.firstName) && normalize(s.lastName) === normalize(r.lastName),
    );
    const s = found ?? (await createStudent(r.firstName, r.lastName));
    if (found) reused++;
    else {
      created++;
      all.push(s);
    }
    await addToGroup(s.id, groupId, subject);
  }
  return { created, reused };
}

// Correction du nom : l'identifiant de connexion est recalculé (prenom.nom)
export async function renameStudent(studentId: string, firstName: string, lastName: string) {
  if (ONLINE) {
    const r = await callStudents<{ login: string }>({ action: 'rename', studentId, firstName, lastName });
    await syncNow();
    return r.login;
  }
  const base = [normalize(firstName), normalize(lastName)].filter(Boolean).join('.') || 'eleve';
  let login = base;
  for (let n = 2; ; n++) {
    const other = await db.students.where('login').equals(login).first();
    if (!other || other.id === studentId) break;
    login = base + n;
  }
  await db.students.update(studentId, { firstName: firstName.trim(), lastName: lastName.trim(), login });
  return login;
}

export async function resetPassword(studentId: string) {
  if (ONLINE) {
    await callStudents({ action: 'reset', studentId });
    await syncNow();
  } else await db.students.update(studentId, { password: randomPassword() });
}

async function forgetStudentLocally(studentId: string) {
  const student = await db.students.get(studentId);
  await localOnly(['students', 'memberships', 'studentCards', 'reviews', 'trombi', 'media', 'notes'], async () => {
    await db.notes.where('studentId').equals(studentId).delete();
    await db.memberships.where('studentId').equals(studentId).delete();
    await db.studentCards.where('studentId').equals(studentId).delete();
    await db.reviews.where('studentId').equals(studentId).delete();
    await db.trombi.filter((t) => t.studentId === studentId).delete();
    if (student?.photoId) await db.media.delete(student.photoId);
    await db.students.delete(studentId);
  });
}

// Suppression définitive d'un élève (compte, photo, progression, historique)
export async function deleteStudent(studentId: string) {
  if (ONLINE) await callStudents({ action: 'delete', studentId });
  await forgetStudentLocally(studentId);
}

// Suppression d'une classe ; avec `deleteOrphans`, les élèves qui ne sont dans aucune autre classe sont supprimés aussi
export async function deleteGroup(groupId: string, deleteOrphans: boolean) {
  const ms = await db.memberships.where('groupId').equals(groupId).toArray();
  const orphans: string[] = [];
  if (deleteOrphans) {
    for (const m of ms) {
      const others = await db.memberships.where('studentId').equals(m.studentId).filter((x) => x.groupId !== groupId).count();
      if (!others) orphans.push(m.studentId);
    }
  }
  if (ONLINE) await callStudents({ action: 'deleteGroup', groupId, deleteOrphans });
  for (const id of orphans) await forgetStudentLocally(id);
  await localOnly(['groups', 'memberships', 'publications'], async () => {
    await db.memberships.where('groupId').equals(groupId).delete();
    await db.publications.where('groupId').equals(groupId).delete();
    await db.groups.delete(groupId);
  });
  return orphans.length;
}
