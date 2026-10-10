// Recherche rapide d'un élève (nom ou prénom, sans tenir compte des accents) dans toutes les classes actives.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Group, type Student } from '../lib/db';
import { StudentName } from './Avatar';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function useAllStudents() {
  return useLiveQuery(async () => {
    const groups = (await db.groups.filter((g) => !g.archived).toArray()).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
    const ms = await db.memberships.toArray();
    const ids = new Set(groups.map((g) => g.id));
    const byStudent = new Map<string, Group>();
    for (const m of ms) if (ids.has(m.groupId) && !byStudent.has(m.studentId)) byStudent.set(m.studentId, groups.find((g) => g.id === m.groupId)!);
    const students = ((await db.students.bulkGet([...byStudent.keys()])).filter(Boolean) as Student[]).sort(
      (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
    );
    return { groups, students: students.map((s) => ({ student: s, group: byStudent.get(s.id)! })) };
  }, []);
}

export function StudentSearch({ autoFocus = false, max = 8 }: { autoFocus?: boolean; max?: number }) {
  const data = useAllStudents();
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const words = norm(q).split(/\s+/).filter(Boolean);
  const hits = words.length
    ? (data?.students ?? []).filter(({ student: s }) => words.every((w) => norm(`${s.firstName} ${s.lastName}`).includes(w))).slice(0, max)
    : [];
  const open = (id: string, gid: string) => nav(`/prof/eleves/${id}?classe=${gid}`);

  return (
    <div className="stack" style={{ gap: 6, position: 'relative' }}>
      <input
        type="search"
        autoFocus={autoFocus}
        placeholder="🔍 Nom ou prénom…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && hits[0] && open(hits[0].student.id, hits[0].group.id)}
        onClick={(e) => e.preventDefault()}
        style={{ width: '100%' }}
      />
      {hits.length > 0 && (
        <div className="stack" style={{ gap: 2 }}>
          {hits.map(({ student, group }) => (
            <button
              key={student.id}
              className="btn small ghost"
              style={{ justifyContent: 'space-between', display: 'flex', background: 'var(--paper)' }}
              onClick={(e) => {
                e.preventDefault();
                open(student.id, group.id);
              }}
            >
              <StudentName student={student} size={26} />
              <span className="chip" style={{ background: group.color }}>
                {group.name}
              </span>
            </button>
          ))}
        </div>
      )}
      {words.length > 0 && !hits.length && <span className="small muted">Aucun élève trouvé.</span>}
    </div>
  );
}
