// Import de planches PDF : lecture, aperçu des paires recto / verso, puis import.
import { useState } from 'react';
import { readPlanche, pairsOf, importPairs, type Planche } from '../lib/planches';
import { runOcr } from '../lib/ocr';
import { isStaleVersionError } from './UpdateBanner';

export function PlancheImport({ subject }: { subject: string }) {
  const [items, setItems] = useState<{ pl: Planche; mirrored: boolean; skip: Set<string> }[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setMsg('');
    const out = [];
    try {
      for (const f of [...files]) out.push({ pl: await readPlanche(f, setBusy), mirrored: true, skip: new Set<string>() });
      setItems(out);
    } catch (e) {
      setMsg(isStaleVersionError(e) ? 'FoxBox a été mis à jour : rechargez la page puis recommencez.' : (e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function doImport() {
    let added = 0;
    let updated = 0;
    for (const it of items) {
      setBusy(`Import de ${it.pl.fileName}…`);
      const pairs = pairsOf(it.pl, it.mirrored).filter((p) => !it.skip.has(p.key));
      const r = await importPairs(it.pl, pairs, subject);
      added += r.added;
      updated += r.updated;
    }
    setBusy('');
    setItems([]);
    setMsg(`${added} carte(s) ajoutée(s), ${updated} mise(s) à jour. Elles figurent dans « Derniers imports » (annulables).`);
    runOcr();
  }

  const total = items.reduce((a, it) => a + pairsOf(it.pl, it.mirrored).filter((p) => !it.skip.has(p.key)).length, 0);

  return (
    <div className="panel stack">
      <h2>Importer des planches PDF (recto / verso)</h2>
      <p className="muted" style={{ margin: 0 }}>
        Pour les planches de cartes faites pour l'impression : page 1 = rectos, page 2 = versos (et ainsi de suite). La grille est
        détectée automatiquement et chaque recto est associé à son verso. Vérifiez les paires avant d'importer.
      </p>
      <div className="row">
        <label className="btn primary" style={{ alignSelf: 'flex-start' }}>
          Choisir un ou plusieurs PDF
          <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => onFiles(e.target.files)} disabled={!!busy} />
        </label>
        <span className="small muted">Matière : {subject} (choisie plus haut)</span>
      </div>
      {busy && <div className="notice">{busy}</div>}
      {msg && <div className="notice">{msg}</div>}
      {items.map((it, k) => {
        const pairs = pairsOf(it.pl, it.mirrored);
        return (
          <div key={k} className="stack" style={{ borderTop: '2px dashed var(--muted-line)', paddingTop: 10 }}>
            <div className="spread">
              <b>
                {it.pl.fileName} — {pairs.length} carte(s){it.pl.level ? ` · ${it.pl.level}` : ''}
              </b>
              <label className="row small" style={{ gap: 6, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={it.mirrored}
                  onChange={(e) => setItems(items.map((x, j) => (j === k ? { ...x, mirrored: e.target.checked } : x)))}
                />
                Verso retourné (impression recto-verso)
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
              {pairs.map((p) => {
                const off = it.skip.has(p.key);
                return (
                  <label
                    key={p.key}
                    className="stack"
                    style={{ gap: 4, padding: 6, borderRadius: 10, border: '2px solid var(--muted-line)', opacity: off ? 0.35 : 1, cursor: 'pointer', background: 'var(--paper)' }}
                  >
                    <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      <img src={p.front.thumb} alt="" style={{ width: '50%', border: '1px solid var(--muted-line)' }} />
                      <img src={p.back.thumb} alt="" style={{ width: '50%', border: '1px solid var(--muted-line)' }} />
                    </div>
                    <span className="row small" style={{ gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={!off}
                        onChange={() => {
                          const s = new Set(it.skip);
                          if (s.has(p.key)) s.delete(p.key);
                          else s.add(p.key);
                          setItems(items.map((x, j) => (j === k ? { ...x, skip: s } : x)));
                        }}
                      />
                      <span className="code">{p.ref}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
      {items.length > 0 && (
        <div className="row">
          <button className="btn primary" onClick={doImport} disabled={!!busy || !total}>
            Importer {total} carte(s)
          </button>
          <button className="btn ghost" onClick={() => setItems([])}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
