import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, fileBlob, type Card } from '../lib/db';
import { THEMES } from '../lib/apkg';
import { cardByGroup } from '../lib/stats';
import { CardFace } from './CardFace';
import { unitLabel } from '../lib/units';
import { RateBar, ThemeChip } from './widgets';

const THEME_LIST = Object.values(THEMES);

// Image déjà présente dans FoxBox (même nom et même taille) : on la réutilise au lieu d'en créer un doublon
async function storeImage(name: string, blob: Blob) {
  const same = await db.media.where('name').equals(name).filter((m) => m.blob?.size === blob.size).first();
  if (same) return same.id;
  const id = uid();
  await db.media.put({ id, name, blob });
  return id;
}

// onImage : une image insérée est enregistrée tout de suite (sans attendre « Enregistrer »)
function FaceEditor({ label, html, onChange, onImage }: { label: string; html: string; onChange: (h: string) => void; onImage: (h: string) => void }) {
  const ta = useRef<HTMLTextAreaElement>(null);
  // Entoure la sélection (ou insère des marques vides) puis replace le curseur
  function wrap(before: string, after: string) {
    const el = ta.current;
    if (!el) return;
    const a = el.selectionStart;
    const b = el.selectionEnd;
    onChange(html.slice(0, a) + before + html.slice(a, b) + after + html.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, b + before.length);
    });
  }
  // Image par lien : copiée dans FoxBox si le site le permet (fonctionne hors ligne), sinon simple lien
  async function addImageUrl() {
    const url = prompt("Adresse de l'image (clic droit sur l'image › « Copier l'adresse de l'image »)")?.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return alert("L'adresse doit commencer par http:// ou https://");
    let tag = `<img src="${url.replace(/"/g, '%22')}">`;
    try {
      const r = await fetch(url);
      const blob = r.ok ? await r.blob() : null;
      if (blob && blob.type.startsWith('image/')) tag = `<img src="media:${await storeImage(url.split('/').pop()?.split('?')[0] || 'image', blob)}">`;
    } catch {
      /* le site refuse la copie : on garde le lien */
    }
    onImage(html + tag);
  }

  async function addImage(f: File | undefined, replace: boolean) {
    if (!f) return;
    const tag = `<img src="media:${await storeImage(f.name, await fileBlob(f))}">`;
    onImage(replace ? tag : html + tag);
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="spread">
        <h3 style={{ margin: 0 }}>{label}</h3>
        <div className="row" style={{ gap: 6 }}>
          <label className="btn small">
            Remplacer par une image
            <input type="file" accept="image/*" hidden onChange={(e) => addImage(e.target.files?.[0], true)} />
          </label>
          <button type="button" className="btn small ghost" onClick={addImageUrl} title="Insérer une image à partir de son adresse internet">
            🔗 Image par lien
          </button>
          <label className="btn small ghost">
            + Insérer une image
            <input type="file" accept="image/*" hidden onChange={(e) => addImage(e.target.files?.[0], false)} />
          </label>
        </div>
      </div>
      <div className="row" style={{ gap: 4 }}>
        <button type="button" className="btn small ghost" style={{ fontWeight: 900, minWidth: 34 }} title="Gras (⌘B) : sélectionnez le texte puis cliquez" onClick={() => wrap('**', '**')}>
          G
        </button>
        <button type="button" className="btn small ghost" style={{ fontStyle: 'italic', minWidth: 34 }} title="Italique (⌘I)" onClick={() => wrap('<i>', '</i>')}>
          I
        </button>
        <button type="button" className="btn small ghost" style={{ textDecoration: 'underline', minWidth: 34 }} title="Souligné (⌘U)" onClick={() => wrap('<u>', '</u>')}>
          S
        </button>
        <button type="button" className="btn small ghost" title="Formule : sélectionnez-la puis cliquez" onClick={() => wrap('$', '$')}>
          $ formule $
        </button>
      </div>
      <textarea
        ref={ta}
        value={html}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!(e.metaKey || e.ctrlKey)) return;
          const k = e.key.toLowerCase();
          if (k === 'b') (e.preventDefault(), wrap('**', '**'));
          else if (k === 'i') (e.preventDefault(), wrap('<i>', '</i>'));
          else if (k === 'u') (e.preventDefault(), wrap('<u>', '</u>'));
        }}
      />
      <div className="small muted">
        <span className="code">**mot**</span> pour le gras ; formules entre <span className="code">$ … $</span> (ex. <span className="code">$E_c=\frac{'{1}{2}'}mv^2$</span>), ou{' '}
        <span className="code">$$ … $$</span> pour une formule centrée sur sa ligne.
      </div>
      <div className="panel" style={{ boxShadow: 'none', padding: 10 }}>
        <CardFace html={html} />
      </div>
    </div>
  );
}

export function CardDetail({
  cardId,
  onClose,
  startEditing = false,
  siblings,
  onNavigate,
}: {
  cardId: string;
  onClose: () => void;
  startEditing?: boolean;
  siblings?: string[]; // flashcards de la liste d'origine, pour passer à la suivante (← →)
  onNavigate?: (id: string, editing: boolean) => void;
}) {
  const card = useLiveQuery(() => db.cards.get(cardId), [cardId]);
  const stats = useLiveQuery(() => cardByGroup(cardId), [cardId]);
  const units = useLiveQuery(async () => {
    const links = await db.unitCards.where('cardId').equals(cardId).toArray();
    const us = await db.units.bulkGet(links.map((l) => l.unitId));
    const out = [];
    for (const u of us) {
      if (!u) continue;
      const parent = u.parentId ? await db.units.get(u.parentId) : undefined;
      out.push(parent ? `${unitLabel(parent)} › ${unitLabel(u)}` : unitLabel(u));
    }
    return out;
  }, [cardId]);
  const [edit, setEdit] = useState<Card | null>(null);
  // Texte brut du champ tags : découpé seulement à l'enregistrement (sinon la virgule tapée disparaît aussitôt)
  const [tagsText, setTagsText] = useState('');
  useEffect(() => {
    if (edit) setTagsText(edit.tags.filter((t) => t !== edit.level && t !== edit.theme).join(', '));
  }, [edit?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (startEditing && card && !edit) setEdit({ ...card });
  }, [card, startEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flashcard précédente / suivante : enregistrement automatique si on est en train de modifier
  const idx = siblings?.indexOf(cardId) ?? -1;
  const go = async (d: number) => {
    const next = siblings?.[idx + d];
    if (!next || !onNavigate) return;
    const editing = !!edit;
    if (edit) await save();
    onNavigate(next, editing);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? '')) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!card) return null;

  async function save() {
    if (!edit) return;
    const contentChanged = edit.front !== card!.front || edit.back !== card!.back;
    await db.cards.put({
      ...edit,
      tags: [...new Set([edit.level, edit.theme, ...tagsText.split(',').map((t) => t.trim())].filter(Boolean) as string[])],
      updatedAt: Date.now(),
      ocrDone: contentChanged && /src="media:/.test(edit.front + edit.back) ? false : edit.ocrDone,
    });
    setEdit(null);
  }

  // Annuler la création d'une flashcard restée vide : on ne laisse pas de flashcard blanche (ni de lien vers une séquence)
  async function cancel() {
    if (!card!.front.trim() && !card!.back.trim()) {
      await db.unitCards.where('cardId').equals(card!.id).delete();
      await db.cards.update(card!.id, { deleted: true, updatedAt: Date.now() });
      onClose();
    } else setEdit(null);
  }

  // La flashcard est seulement marquée supprimée : ses images restent (une autre flashcard peut les utiliser)
  async function remove() {
    if (!confirm(`Supprimer la flashcard ${card!.code} ? Elle disparaîtra des révisions des élèves (leur historique est conservé).`)) return;
    await db.cards.update(card!.id, { deleted: true, updatedAt: Date.now() });
    onClose();
  }

  return (
    <>
      <div className="drawer-bg light" onClick={onClose} />
      <aside className="drawer left stack">
        <div className="spread">
          <div className="row">
            <h2 style={{ margin: 0 }}>{card.code}</h2>
            {card.sourceRef && <span className="code muted">{card.sourceRef}</span>}
            <ThemeChip theme={card.theme} />
            {card.level && <span className="chip">{card.level}</span>}
          </div>
          <div className="row">
            {siblings && siblings.length > 1 && idx >= 0 && (
              <span className="row" style={{ gap: 4 }}>
                <button className="btn small ghost" disabled={idx === 0} onClick={() => go(-1)} title="Flashcard précédente (←)">
                  ◀
                </button>
                <span className="small muted">
                  {idx + 1}/{siblings.length}
                </span>
                <button className="btn small ghost" disabled={idx === siblings.length - 1} onClick={() => go(1)} title="Flashcard suivante (→)">
                  ▶
                </button>
              </span>
            )}
            {!edit && (
              <button className="btn primary" onClick={() => setEdit({ ...card })}>
                Modifier
              </button>
            )}
            <button className="btn ghost" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>

        {!edit ? (
          <>
            <div className="grid2">
              <div className="panel stack">
                <h3>Recto</h3>
                <CardFace html={card.front} />
              </div>
              <div className="panel stack">
                <h3>Verso</h3>
                <CardFace html={card.back} />
              </div>
            </div>
            <div className="panel stack">
              <h3>Réussite par classe</h3>
              {stats?.length ? (
                <table className="list">
                  <tbody>
                    {stats.map(({ group, agg }) => (
                      <tr key={group.id}>
                        <td style={{ width: 120 }}>
                          <b>{group.name}</b>
                        </td>
                        <td>
                          <RateBar agg={agg} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <span className="muted">Aucune classe pour cette matière.</span>
              )}
            </div>
            <div className="panel stack">
              <h3>Séquences</h3>
              {units?.length ? (
                <ul style={{ margin: 0 }}>{units.map((u) => <li key={u}>{u}</li>)}</ul>
              ) : (
                <span className="muted">Cette flashcard n'est dans aucune séquence.</span>
              )}
              {card.tags.length > 0 && (
                <div className="small">
                  <b>Tags :</b> {card.tags.join(', ')}
                </div>
              )}
              {(card.ocrFront || card.ocrBack) && (
                <details className="small">
                  <summary>Texte lu dans les images (pour la recherche)</summary>
                  <p>
                    <b>Recto :</b> {card.ocrFront}
                    <br />
                    <b>Verso :</b> {card.ocrBack}
                  </p>
                </details>
              )}
            </div>
          </>
        ) : (
          <div className="stack">
            <div className="panel stack">
              <FaceEditor
                label="Recto"
                html={edit.front}
                onChange={(front) => setEdit({ ...edit, front })}
                onImage={(front) => (setEdit({ ...edit, front }), db.cards.update(card.id, { front, ocrDone: false, updatedAt: Date.now() }))}
              />
            </div>
            <div className="panel stack">
              <FaceEditor
                label="Verso"
                html={edit.back}
                onChange={(back) => setEdit({ ...edit, back })}
                onImage={(back) => (setEdit({ ...edit, back }), db.cards.update(card.id, { back, ocrDone: false, updatedAt: Date.now() }))}
              />
            </div>
            <div className="panel stack">
              <div className="row">
                <label className="field">
                  Niveau
                  <select value={edit.level ?? ''} onChange={(e) => setEdit({ ...edit, level: e.target.value || undefined })}>
                    <option value="">—</option>
                    {['6e', '5e', '4e', '3e'].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Thème
                  <select value={edit.theme ?? ''} onChange={(e) => setEdit({ ...edit, theme: e.target.value || undefined })}>
                    <option value="">—</option>
                    {THEME_LIST.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ flex: 1, minWidth: 200 }}>
                  Autres tags (séparés par des virgules)
                  <input
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                Texte de recherche (lu dans les images, corrigeable)
                <textarea
                  style={{ minHeight: 60, fontFamily: 'inherit' }}
                  value={[edit.ocrFront, edit.ocrBack].filter(Boolean).join(' — ')}
                  onChange={(e) => setEdit({ ...edit, ocrFront: e.target.value, ocrBack: '', ocrDone: true })}
                />
              </label>
            </div>
            <div className="spread">
              <button className="btn danger" onClick={remove}>
                Supprimer la flashcard
              </button>
              <div className="row">
                <button className="btn ghost" onClick={cancel}>
                  Annuler
                </button>
                <button
                  className="btn primary"
                  onClick={async () => {
                    await save();
                    onClose();
                  }}
                >
                  Enregistrer et fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
