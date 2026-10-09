import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type Card } from '../lib/db';
import { THEMES } from '../lib/apkg';
import { cardByGroup } from '../lib/stats';
import { CardFace } from './CardFace';
import { unitLabel } from '../lib/units';
import { RateBar, ThemeChip } from './widgets';

const THEME_LIST = Object.values(THEMES);

function FaceEditor({ label, html, onChange }: { label: string; html: string; onChange: (h: string) => void }) {
  async function addImage(f: File | undefined, replace: boolean) {
    if (!f) return;
    const id = uid();
    await db.media.put({ id, name: f.name, blob: f });
    const tag = `<img src="media:${id}">`;
    onChange(replace ? tag : html + tag);
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
          <label className="btn small ghost">
            + Insérer une image
            <input type="file" accept="image/*" hidden onChange={(e) => addImage(e.target.files?.[0], false)} />
          </label>
        </div>
      </div>
      <textarea value={html} onChange={(e) => onChange(e.target.value)} />
      <div className="small muted">
        Texte libre ; formules entre <span className="code">\( … \)</span> ou <span className="code">\[ … \]</span>, comme dans Anki.
      </div>
      <div className="panel" style={{ boxShadow: 'none', padding: 10 }}>
        <CardFace html={html} />
      </div>
    </div>
  );
}

export function CardDetail({ cardId, onClose, startEditing = false }: { cardId: string; onClose: () => void; startEditing?: boolean }) {
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

  async function remove() {
    if (!confirm(`Supprimer la carte ${card!.code} ? Elle disparaîtra des révisions des élèves (leur historique est conservé).`)) return;
    await db.cards.update(card!.id, { deleted: true, updatedAt: Date.now() });
    onClose();
  }

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer stack">
        <div className="spread">
          <div className="row">
            <h2 style={{ margin: 0 }}>{card.code}</h2>
            {card.sourceRef && <span className="code muted">{card.sourceRef}</span>}
            <ThemeChip theme={card.theme} />
            {card.level && <span className="chip">{card.level}</span>}
          </div>
          <div className="row">
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
                <span className="muted">Cette carte n'est dans aucune séquence.</span>
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
              <FaceEditor label="Recto" html={edit.front} onChange={(front) => setEdit({ ...edit, front })} />
            </div>
            <div className="panel stack">
              <FaceEditor label="Verso" html={edit.back} onChange={(back) => setEdit({ ...edit, back })} />
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
                Supprimer la carte
              </button>
              <div className="row">
                <button className="btn ghost" onClick={() => setEdit(null)}>
                  Annuler
                </button>
                <button className="btn primary" onClick={save}>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
