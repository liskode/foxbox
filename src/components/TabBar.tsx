// Onglets d'une page : liens côte à côte sur ordinateur, menu déroulant sur téléphone.
import { Icon } from './Icon';

export function TabBar<T extends string>({
  tabs,
  current,
  onChange,
  variant = 'pills',
}: {
  tabs: readonly (readonly [T, string])[];
  current: T;
  onChange: (t: T) => void;
  variant?: 'pills' | 'underline';
}) {
  return (
    <>
      <nav className={(variant === 'pills' ? 'nav' : 'tabs') + ' tabbar-desk'} style={variant === 'pills' ? { flex: 'none' } : undefined}>
        {tabs.map(([k, l]) => (
          <a key={k} href="#" className={current === k ? 'active' : ''} onClick={(e) => (e.preventDefault(), onChange(k))}>
            {l}
          </a>
        ))}
      </nav>
      <label className="tab-select">
        <select value={current} onChange={(e) => onChange(e.target.value as T)} aria-label="Partie de la page">
          {tabs.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={18} />
      </label>
    </>
  );
}
