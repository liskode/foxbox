// Champ d'heure : la saisie en cours reste dans le champ (« 1 » puis « 4 » donne 14 h) et n'est enregistrée
// qu'en quittant le champ ou avec Entrée. Enregistrer à chaque chiffre fait relire le champ et coupe la saisie.
import { useEffect, useState } from 'react';

export function TimeInput({ value, onChange, step }: { value?: string; onChange: (v: string) => void; step?: number }) {
  const [v, setV] = useState(value ?? '');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setV(value ?? '');
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    if (v !== (value ?? '')) onChange(v);
  };
  return (
    <input
      type="time"
      value={v}
      step={step}
      onFocus={() => setEditing(true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}
