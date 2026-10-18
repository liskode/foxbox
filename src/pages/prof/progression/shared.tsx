// Progression : outils communs (préférence « masquer ce qui est terminé », calcul partagé, création de séquence).
import { useState } from 'react';
import { askForm } from '../../../components/Dialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, SUBJECTS, type Unit } from '../../../lib/db';
import { nextSequenceCode, themesFor } from '../../../lib/units';
import { levelPlans } from '../../../lib/forecast';
import { useAuth } from '../../../lib/auth';

// « Masquer ce qui est terminé » : préférence gardée dans le navigateur
export function useHideDone(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    try {
      return localStorage.getItem('foxbox-hide-done') === '1';
    } catch {
      return false;
    }
  });
  return [
    v,
    (x: boolean) => {
      setV(x);
      try {
        localStorage.setItem('foxbox-hide-done', x ? '1' : '0');
      } catch {
        /* navigation privée */
      }
    },
  ];
}

export function HideDoneToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row small" style={{ gap: 6, fontWeight: 700 }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      Masquer ce qui est terminé
    </label>
  );
}

export function usePlans(subject = SUBJECTS[0]) {
  const { session } = useAuth();
  return useLiveQuery(() => levelPlans(session!.id, subject), [session?.id, subject]);
}

// Matière affichée dans la Progression (gardée dans le navigateur) et matières utilisées (classes, soutien, séquences)
export function useSubject(): [string, (s: string) => void] {
  const [v, setV] = useState(() => {
    try {
      return localStorage.getItem('foxbox-subject') || SUBJECTS[0];
    } catch {
      return SUBJECTS[0];
    }
  });
  return [
    v,
    (x: string) => {
      setV(x);
      try {
        localStorage.setItem('foxbox-subject', x);
      } catch {
        /* navigation privée */
      }
    },
  ];
}
export function useSubjectsInUse() {
  return useLiveQuery(
    async () => {
      const set = new Set([SUBJECTS[0]]);
      (await db.groups.toArray()).forEach((g) => {
        if (g.archived) return;
        set.add(g.subject);
        g.tracks?.forEach((t) => set.add(t.subject));
      });
      (await db.units.toArray()).forEach((u) => u.subject && set.add(u.subject));
      return SUBJECTS.filter((s) => set.has(s));
    },
    [],
    [SUBJECTS[0]],
  );
}

export async function createSequence(level: string, units: Unit[], subject = SUBJECTS[0]) {
  const names = themesFor(level, subject);
  const r = await askForm(
    `Nouvelle séquence de ${level}${subject !== SUBJECTS[0] ? ` (${subject})` : ''}`,
    [
      {
        key: 'theme',
        label: 'Thème',
        value: '1',
        options: Object.entries(names).map(([k, v]) => ({ value: k, label: k === '0' ? v : `${k} – ${v}` })),
      },
      { key: 'name', label: 'Titre de la séquence', placeholder: 'La masse volumique' },
    ],
    'Créer la séquence',
  );
  if (!r) return;
  const { theme, name } = r;
  let code;
  try {
    code = await nextSequenceCode(level, theme, subject);
  } catch (e) {
    alert((e as Error).message);
    return;
  }
  const order = Math.max(0, ...units.filter((x) => x.kind === 'sequence' && x.level === level && (x.subject || SUBJECTS[0]) === subject).map((x) => x.order)) + 1;
  const u: Unit = { id: uid(), kind: 'sequence', subject, level, theme, name, order, code };
  await db.units.put(u);
  return u;
}
