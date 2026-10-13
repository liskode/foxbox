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

export function usePlans() {
  const { session } = useAuth();
  return useLiveQuery(() => levelPlans(session!.id), [session?.id]);
}

export async function createSequence(level: string, units: Unit[]) {
  const names = themesFor(level);
  const r = await askForm(
    `Nouvelle séquence de ${level}`,
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
    code = await nextSequenceCode(level, theme);
  } catch (e) {
    alert((e as Error).message);
    return;
  }
  const order = Math.max(0, ...units.filter((x) => x.kind === 'sequence' && x.level === level).map((x) => x.order)) + 1;
  const u: Unit = { id: uid(), kind: 'sequence', subject: SUBJECTS[0], level, theme, name, order, code };
  await db.units.put(u);
  return u;
}
