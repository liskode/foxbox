// Pastilles de compétences d'un critère : APP, ANA, REA, VAL, COM (et leurs sous-compétences)
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../lib/auth';
import { categories, childrenOf, DEFAULT_COMPETENCES, loadCompetences, type Competence } from '../lib/competences';

export function useCompetences() {
  const { session } = useAuth();
  return useLiveQuery(() => loadCompetences(session!.id), [session?.id], DEFAULT_COMPETENCES);
}

export function CompetenceChip({ c, on = true, onClick, small }: { c: Competence; on?: boolean; onClick?: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      title={c.name}
      onClick={onClick}
      style={{
        border: `1.5px ${on ? 'solid' : 'dashed'} ${on ? '#00000055' : 'var(--muted-line)'}`,
        background: on ? c.color : 'transparent',
        color: on ? 'var(--ink)' : '#9a968d',
        borderRadius: 6,
        padding: small ? '0 4px' : '1px 6px',
        fontSize: small ? '0.7rem' : '0.75rem',
        fontWeight: 800,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {c.code}
    </button>
  );
}

export function CompetencePicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const list = useCompetences();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="row" style={{ gap: 3, marginTop: 4 }}>
      {categories(list).map((cat) => {
        const kids = childrenOf(list, cat.id);
        const open = value.includes(cat.id) || kids.some((k) => value.includes(k.id));
        return (
          <span key={cat.id} className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
            <CompetenceChip c={cat} on={value.includes(cat.id)} onClick={() => toggle(cat.id)} />
            {open && kids.map((k) => <CompetenceChip key={k.id} c={k} small on={value.includes(k.id)} onClick={() => toggle(k.id)} />)}
          </span>
        );
      })}
    </div>
  );
}
