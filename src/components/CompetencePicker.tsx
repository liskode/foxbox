// Pastilles de compétences d'un critère : RES, ANA, REA, VAL, COM (et leurs sous-compétences)
import { useState } from 'react';
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

// Pastilles des catégories ; une catégorie cochée affiche ses sous-compétences avec leur intitulé, à cocher si besoin
export function CompetencePicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const list = useCompetences();
  const [shown, setShown] = useState<string[]>([]); // catégories dépliées (toutes les sous-compétences visibles)
  // Une compétence qui a des sous-compétences est définie par celles qui sont cochées : décocher la dernière la retire
  const toggle = (cat: Competence, id: string) =>
    onChange((value.includes(id) ? value.filter((x) => x !== id) : [...value, id]).filter((x) => x !== cat.id));
  // Clic sur une pastille : déplie ses sous-compétences ; un second clic replie (en gardant les choix). Repliée sans
  // sous-compétence cochée, elle est retirée. Une pastille sans sous-compétence se coche / décoche directement.
  const toggleCat = (cat: Competence) => {
    const kids = childrenOf(list, cat.id).map((k) => k.id);
    if (!kids.length) return onChange(value.includes(cat.id) ? value.filter((x) => x !== cat.id) : [...value, cat.id]);
    if (!shown.includes(cat.id)) return setShown([cat.id]);
    setShown([]);
    if (!kids.some((k) => value.includes(k)) && value.includes(cat.id)) onChange(value.filter((x) => x !== cat.id));
  };
  const opened = categories(list).filter((cat) => shown.includes(cat.id) || value.includes(cat.id) || childrenOf(list, cat.id).some((k) => value.includes(k.id)));
  return (
    <div className="stack" style={{ gap: 4, marginTop: 4 }}>
      <div className="row" style={{ gap: 3 }}>
        {categories(list).map((cat) => (
          <CompetenceChip key={cat.id} c={cat} on={opened.includes(cat)} onClick={() => toggleCat(cat)} />
        ))}
      </div>
      {opened.map((cat) => {
        const kids = childrenOf(list, cat.id);
        const all = shown.includes(cat.id);
        if (!kids.some((k) => all || value.includes(k.id))) return null;
        return (
          <div key={cat.id} className="stack" style={{ gap: 2, paddingLeft: 8, borderLeft: `3px solid ${cat.color}` }}>
            {kids.filter((k) => all || value.includes(k.id)).map((k) => (
              <label key={k.id} className="row small" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'flex-start', cursor: 'pointer', fontWeight: value.includes(k.id) ? 700 : 400 }}>
                <input type="checkbox" checked={value.includes(k.id)} onChange={() => toggle(cat, k.id)} style={{ marginTop: 3 }} />
                <span>
                  <span className="muted">{k.code}</span> {k.name}
                </span>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
