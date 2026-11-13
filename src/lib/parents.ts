// Comptes parents : créés par le professeur depuis la fiche Famille, un compte par parent, rattaché à un ou plusieurs enfants.
// Identifiant : l'adresse e-mail du parent si elle est connue, sinon parent.prenom.nom (prénom et nom de l'enfant).
import { db, uid, type FamilyContact, type Parent } from './db';
import { normalize, randomPassword } from './students';
import { ONLINE, callStudents, supabase } from './supabase';
import { localOnly, syncNow } from './sync';

const nameOf = (c: FamilyContact) => [c.name, c.person].filter((x) => x?.trim()).join(' – ') || 'Parent';

export async function createParentAccess(studentId: string, c: FamilyContact) {
  if (ONLINE) {
    const r = await callStudents<{ login: string; password?: string; reused: boolean }>({
      action: 'createParent',
      studentId,
      contactId: c.id,
      name: nameOf(c),
      email: c.email?.trim() || undefined,
    });
    await syncNow();
    return r;
  }
  const email = c.email?.trim().toLowerCase();
  const found = email ? await db.parents.where('login').equals(email).first() : undefined;
  if (found) {
    await db.parents.update(found.id, {
      studentIds: [...new Set([...found.studentIds, studentId])],
      contactIds: [...new Set([...(found.contactIds ?? []), c.id])],
    });
    return { login: found.login, reused: true };
  }
  let login = email;
  if (!login) {
    const s = await db.students.get(studentId);
    const base = ['parent', normalize(s?.firstName ?? ''), normalize(s?.lastName ?? '')].filter(Boolean).join('.');
    login = base;
    for (let n = 2; await db.parents.where('login').equals(login).count(); n++) login = base + n;
  }
  const p: Parent = { id: uid(), name: nameOf(c), login, password: randomPassword(), studentIds: [studentId], contactIds: [c.id], notifyEmail: !!email };
  await db.parents.put(p);
  return { login: p.login, password: p.password, reused: false };
}

export async function resetParentPassword(parentId: string) {
  if (ONLINE) {
    await callStudents({ action: 'resetParent', parentId });
    await syncNow();
  } else await db.parents.update(parentId, { password: randomPassword() });
}

// Retire l'accès d'un parent à un enfant (le compte disparaît s'il n'a plus d'enfant)
export async function removeParentAccess(parentId: string, studentId: string) {
  if (ONLINE) {
    await callStudents({ action: 'removeParent', parentId, studentId });
    // Le compte n'est plus lisible par ce professeur (s'il reste rattaché à un autre enfant) : on l'oublie ici
    await localOnly(['parents'], async () => {
      await db.parents.delete(parentId);
    });
    return;
  }
  const p = await db.parents.get(parentId);
  if (!p) return;
  const left = p.studentIds.filter((x) => x !== studentId);
  if (left.length) await db.parents.update(parentId, { studentIds: left });
  else await db.parents.delete(parentId);
}

// Classes et professeurs de chaque enfant du parent (messagerie, rendez-vous). En ligne, demandés au serveur :
// les parents ne lisent pas les classes elles-mêmes.
export interface ChildLink {
  studentId: string;
  groupId: string;
  teacherId: string;
  teacherName: string;
  subject: string;
}
export async function childrenLinks(studentIds: string[]): Promise<ChildLink[]> {
  if (ONLINE) {
    const { data, error } = await supabase.rpc('my_children_teachers');
    if (!error && data)
      return (data as { student_id: string; group_id: string; teacher_id: string; teacher_name: string | null; subject: string | null }[]).map((r) => ({
        studentId: r.student_id,
        groupId: r.group_id,
        teacherId: r.teacher_id,
        teacherName: r.teacher_name ?? 'Professeur',
        subject: r.subject ?? '',
      }));
  }
  const out: ChildLink[] = [];
  for (const studentId of studentIds)
    for (const m of await db.memberships.where('studentId').equals(studentId).toArray()) {
      const g = await db.groups.get(m.groupId);
      if (!g || g.archived) continue;
      for (const t of g.teacherIds) out.push({ studentId, groupId: g.id, teacherId: t, teacherName: (await db.teachers.get(t))?.name ?? 'Professeur', subject: g.subject });
    }
  return out;
}
