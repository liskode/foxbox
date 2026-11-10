// Pastilles de compétences d'un critère : RES, ANA, REA, VAL, COM (et leurs sous-compétences)
import { useState } from 'react';
import { Icon } from './Icon';
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
  // Une sous-compétence cochée remplace la catégorie entière (sans double compte) ; sans sous-compétence, la catégorie reste cochée
  const toggle = (cat: Competence, id: string) => {
    const kids = childrenOf(list, cat.id).map((k) => k.id);
    const next = (value.includes(id) ? value.filter((x) => x !== id) : [...value, id]).filter((x) => x !== cat.id);
    onChange(next.some((x) => kids.includes(x)) ? next : [...next, cat.id]);
  };
  // Clic sur une pastille : la coche et déplie ses sous-compétences ; ensuite, un clic replie ou déplie la liste
  // (sans décocher). Une pastille sans sous-compétence se coche / décoche directement.
  const kidsOf = (cat: Competence) => childrenOf(list, cat.id).map((k) => k.id);
  const toggleCat = (cat: Competence) => {
    const kids = kidsOf(cat);
    const open = value.includes(cat.id) || kids.some((k) => value.includes(k));
    if (open && kids.length) return setShown(shown.includes(cat.id) ? [] : [cat.id]);
    onChange(open ? value.filter((x) => x !== cat.id) : [...value, cat.id]);
    setShown(open || !kids.length ? [] : [cat.id]);
  };
  const removeCat = (cat: Competence) => {
    const kids = kidsOf(cat);
    onChange(value.filter((x) => x !== cat.id && !kids.includes(x)));
    setShown([]);
  };
  const opened = categories(list).filter((cat) => value.includes(cat.id) || childrenOf(list, cat.id).some((k) => value.includes(k.id)));
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
            {all && (
              <button type="button" className="btn small ghost" style={{ alignSelf: 'flex-start', padding: '0 6px' }} onClick={() => removeCat(cat)}>
                <Icon name="x" size={12} /> retirer {cat.code} de ce critère
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
