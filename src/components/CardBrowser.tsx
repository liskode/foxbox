import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Card } from '../lib/db';
import { CardFace } from './CardFace';
import { themeClass, themeColor } from './widgets';
import { normalize } from '../lib/students';
import { THEMES } from '../lib/apkg';

const strip = (h: string) => h.replace(/<[^>]*>/g, ' ');

export function searchText(c: Card) {
  return normalize(
    [c.code, c.sourceRef, c.tags.join(' '), c.theme, strip(c.front), strip(c.back), c.ocrFront, c.ocrBack].join(' '),
  );
}

export function CardBrowser({
  selected,
  onToggle,
  onToggleMany,
  onOpen,
  exclude,
}: {
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleMany?: (ids: string[], on: boolean) => void;
  onOpen?: (c: Card) => void;
  exclude?: Set<string>;
}) {
  const cards = useLiveQuery(() => db.cards.filter((c) => !c.deleted).toArray(), [], []);
  const linked = useLiveQuery(async () => new Set((await db.unitCards.toArray()).map((u) => u.cardId)), [], new Set<string>());
  const [q, setQ] = useState('');
  const [themes, setThemes] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState('');
  const [tag, setTag] = useState('');
  const [orphans, setOrphans] = useState(false);

  const allThemes = useMemo(
    () => Object.values(THEMES).filter((t) => cards.some((c) => c.theme === t)),
    [cards],
  );
  const allLevels = useMemo(() => [...new Set(cards.map((c) => c.level).filter(Boolean))].sort() as string[], [cards]);
  const allTags = useMemo(
    () => [...new Set(cards.flatMap((c) => c.tags))].filter((t) => t !== '' && !allThemes.includes(t) && !allLevels.includes(t)).sort(),
    [cards, allThemes, allLevels],
  );

  const words = normalize(q) ? q.split(/\s+/).map(normalize).filter(Boolean) : [];
  const list = cards
    .filter((c) => !exclude?.has(c.id))
    .filter((c) => !themes.size || themes.has(c.theme ?? ''))
    .filter((c) => !level || c.level === level)
    .filter((c) => !tag || c.tags.includes(tag))
    .filter((c) => !orphans || !linked.has(c.id))
    .filter((c) => {
      if (!words.length) return true;
      const t = searchText(c);
      return words.every((w) => t.includes(w));
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const toggleTheme = (t: string) => {
    const n = new Set(themes);
    if (n.has(t)) n.delete(t);
    else n.add(t);
    setThemes(n);
  };
  const allSelected = !!selected && list.length > 0 && list.every((c) => selected.has(c.id));

  return (
    <div className="stack">
      <div className="panel stack" style={{ padding: '14px 16px' }}>
        <div className="row">
          <input
            placeholder="Rechercher : mot-clé, code (C0012), référence (410FC03)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          {allLevels.length > 1 && (
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Tous niveaux</option>
              {allLevels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          )}
          {allTags.length > 0 && (
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Tous les tags</option>
              {allTags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
        <div className="row">
          {allThemes.map((t) => (
            <button
              key={t}
              className={'chip ' + themeClass(t) + (themes.size && !themes.has(t) ? ' off' : '')}
              onClick={() => toggleTheme(t)}
            >
              {t}
            </button>
          ))}
          <label className="row small" style={{ gap: 6, fontWeight: 700 }}>
            <input type="checkbox" checked={orphans} onChange={(e) => setOrphans(e.target.checked)} />
            Dans aucune séquence
          </label>
          <span className="muted small" style={{ marginLeft: 'auto' }}>
            {list.length} carte(s)
          </span>
          {onToggleMany && (
            <button className="btn small" onClick={() => onToggleMany(list.map((c) => c.id), !allSelected)} disabled={!list.length}>
              {allSelected ? 'Tout décocher' : `Tout cocher (${list.length})`}
            </button>
          )}
        </div>
      </div>

      <div className="cardgrid">
        {list.map((c) => (
          <button
            key={c.id}
            className={'thumb' + (selected?.has(c.id) ? ' selected' : '')}
            onClick={() => (onToggle ? onToggle(c.id) : onOpen?.(c))}
            title={c.ocrFront || undefined}
          >
            <div className="bar" style={{ background: themeColor(c.theme) }} />
            {onToggle && <div className="check">{selected?.has(c.id) ? '✓' : ''}</div>}
            <div className="face">
              <CardFace html={c.front} />
            </div>
            <div className="meta">
              <span className="code">{c.code}</span>
              <span className="muted small">{c.sourceRef}</span>
              {onToggle && onOpen && (
                <span
                  className="small"
                  style={{ textDecoration: 'underline' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(c);
                  }}
                >
                  voir
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      {!cards.length && (
        <div className="notice">
          Aucune carte. Importez un paquet Anki depuis l'onglet <b>Import</b>, ou créez une carte.
        </div>
      )}
    </div>
  );
}
