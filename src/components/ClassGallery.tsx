// Galerie des élèves d'une classe (photo et prénom, sur deux lignes) et sous-groupes (demi-groupes, îlots…).
// Un sous-groupe choisi comme « pinceau » : un clic sur un élève l'y affecte (ou l'en retire).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, SUBGROUP_COLORS, type Group, type Student, type Subgroup } from '../lib/db';
import { Avatar } from './Avatar';
import { FlagBadges, useAllFlags } from './StudentNote';

export function useClassStudents(groupId: string) {
  return useLiveQuery(async () => {
    const ms = await db.memberships.where('groupId').equals(groupId).toArray();
    return ((await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[]).sort(
      (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
    );
  }, [groupId], [] as Student[]);
}

export const subgroupOf = (group: Group, studentId: string) => group.subgroups?.find((s) => s.studentIds.includes(studentId));

export function ClassGallery({ group }: { group: Group }) {
  const students = useClassStudents(group.id);
  const flags = useAllFlags();
  const nav = useNavigate();
  const subs = group.subgroups ?? [];
  const [brush, setBrush] = useState<string | null>(null);
  const active = subs.find((s) => s.id === brush);
  const save = (list: Subgroup[]) => db.groups.update(group.id, { subgroups: list });

  function add() {
    const name = prompt('Nom du sous-groupe (ex. Groupe 1, Îlot A)', `Groupe ${subs.length + 1}`);
    if (!name?.trim()) return;
    const sg: Subgroup = { id: uid(), name: name.trim(), color: SUBGROUP_COLORS[subs.length % SUBGROUP_COLORS.length], studentIds: [] };
    save([...subs, sg]);
    setBrush(sg.id);
  }

  function assign(st: Student) {
    if (!active) return nav(`/prof/eleves/${st.id}?classe=${group.id}`);
    const inIt = active.studentIds.includes(st.id);
    save(
      subs.map((s) =>
        s.id === active.id
          ? { ...s, studentIds: inIt ? s.studentIds.filter((x) => x !== st.id) : [...s.studentIds, st.id] }
          : { ...s, studentIds: s.studentIds.filter((x) => x !== st.id) },
      ),
    );
  }

  return (
    <div className="panel stack" style={{ gap: 10 }}>
      <div className="spread">
        <div className="row" style={{ gap: 6 }}>
          <h3 style={{ margin: 0 }}>Élèves ({students.length})</h3>
          {subs.map((s) => (
            <button
              key={s.id}
              className="chip"
              onClick={() => setBrush(brush === s.id ? null : s.id)}
              title={brush === s.id ? 'Cliquez sur les élèves pour les affecter à ce groupe (ou les en retirer)' : 'Choisir ce groupe pour y affecter des élèves'}
              style={{ background: brush === s.id ? s.color : 'var(--paper)', color: brush === s.id ? '#fff' : 'var(--ink)', borderColor: s.color }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, border: '1.5px solid #fff' }} />
              {s.name} · {s.studentIds.filter((id) => students.some((x) => x.id === id)).length}
            </button>
          ))}
          <button className="btn small ghost" onClick={add}>
            + Sous-groupe
          </button>
        </div>
        {active && (
          <div className="row" style={{ gap: 6 }}>
            <button
              className="btn small ghost"
              onClick={() => {
                const name = prompt('Nom du sous-groupe', active.name);
                if (name?.trim()) save(subs.map((s) => (s.id === active.id ? { ...s, name: name.trim() } : s)));
              }}
            >
              Renommer
            </button>
            <button
              className="btn small danger"
              onClick={() => {
                if (!confirm(`Supprimer le sous-groupe « ${active.name} » ?`)) return;
                save(subs.filter((s) => s.id !== active.id));
                setBrush(null);
              }}
            >
              Supprimer
            </button>
            <button className="btn small primary" onClick={() => setBrush(null)}>
              Terminé
            </button>
          </div>
        )}
      </div>
      {active && (
        <span className="small" style={{ color: active.color, fontWeight: 800 }}>
          Cliquez sur les élèves à mettre dans « {active.name} » (un second clic les retire).
        </span>
      )}
      <div style={{ display: 'grid', gridTemplateRows: 'repeat(2, auto)', gridAutoFlow: 'column', gridAutoColumns: 76, gap: '8px 6px', overflowX: 'auto', paddingBottom: 4 }}>
        {students.map((st) => {
          const sg = subgroupOf(group, st.id);
          return (
            <button
              key={st.id}
              onClick={() => assign(st)}
              title={`${st.firstName} ${st.lastName}${sg ? ` · ${sg.name}` : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                font: 'inherit',
                opacity: active && sg?.id !== active.id ? 0.55 : 1,
              }}
            >
              <span style={{ borderRadius: '50%', padding: 2, border: `3px solid ${sg?.color ?? 'transparent'}`, display: 'inline-flex' }}>
                <Avatar student={st} size={50} zoom />
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.1, maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {st.firstName}
              </span>
              <FlagBadges flags={flags.get(st.id)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
