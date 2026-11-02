// Champ de texte qui garde la frappe en cours (le curseur reste où on l'a mis) et n'enregistre qu'après une courte
// pause ou en quittant le champ. Enregistrer à chaque touche fait redessiner le champ et renvoie le curseur à la fin.
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

export function LazyInput({
  value,
  onSave,
  delay = 600,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onSave: (v: string) => void; delay?: number }) {
  const [v, setV] = useState(value);
  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!editing.current) setV(value);
  }, [value]);
  const flush = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (next !== value) onSave(next);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <input
      {...rest}
      value={v}
      onFocus={(e) => {
        editing.current = true;
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setV(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => flush(next), delay);
      }}
      onBlur={(e) => {
        editing.current = false;
        flush(v);
        rest.onBlur?.(e);
      }}
    />
  );
}
