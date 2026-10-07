import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { importApkg, type ImportReport } from '../../lib/apkg';
import { db, SUBJECTS, resetAll } from '../../lib/db';
import { runOcr, subscribeOcr, type OcrState } from '../../lib/ocr';
import { generateDemo } from '../../lib/demo';
import { ONLINE } from '../../lib/supabase';

export function ImportPage() {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [err, setErr] = useState('');
  const [ocr, setOcr] = useState<OcrState | null>(null);
  const cardCount = useLiveQuery(() => db.cards.filter((c) => !c.deleted).count(), [], 0);
  const ocrPending = useLiveQuery(() => db.cards.filter((c) => !c.deleted && !c.ocrDone).count(), [], 0);
  const demo = useLiveQuery(() => db.meta.get('demo'));

  useEffect(() => {
    const off = subscribeOcr(setOcr);
    return () => {
      off();
    };
  }, []);

  async function onFile(f?: File) {
    if (!f) return;
    setErr('');
    setReport(null);
    try {
      const r = await importApkg(f, subject, setBusy);
      setReport(r);
      runOcr();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function demoData() {
    setErr('');
    setBusy('Création des classes et simulation de 30 jours de révisions…');
    try {
      await generateDemo();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="page stack">
      <h1 className="title">Import</h1>

      <div className="panel stack">
        <h2>1. Importer un paquet Anki (.apkg)</h2>
        <p className="muted" style={{ margin: 0 }}>
          Les cartes recto/verso, leurs images et formules sont importées. Si vous ré-importez un paquet corrigé dans Anki,
          les cartes existantes sont mises à jour sans perdre la progression des élèves.
        </p>
        <div className="row">
          <label className="field">
            Matière
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="btn primary" style={{ alignSelf: 'flex-end' }}>
            Choisir le fichier .apkg
            <input type="file" accept=".apkg" hidden onChange={(e) => onFile(e.target.files?.[0])} disabled={!!busy} />
          </label>
        </div>
        {busy && <div className="notice">{busy}</div>}
        {err && <div className="notice" style={{ borderColor: 'var(--forgot)' }}>{err}</div>}
        {report && (
          <div className="notice">
            <b>Import terminé :</b> {report.added} carte(s) ajoutée(s), {report.updated} mise(s) à jour, {report.media} image(s).
            {report.skipped.length > 0 && (
              <details>
                <summary>{report.skipped.length} carte(s) non importée(s)</summary>
                <ul>
                  {report.skipped.map((s, i) => (
                    <li key={i}>
                      {s.reason} : {s.preview}
                    </li>
                  ))}
                </ul>
              </details>
            )}{' '}
            <Link to="/prof/cartes">Voir les cartes →</Link>
          </div>
        )}
      </div>

      <div className="panel stack">
        <h2>2. Lecture du texte des images</h2>
        <p className="muted" style={{ margin: 0 }}>
          Vos cartes sont des images : FoxBox lit leur texte pour que la recherche par mot-clé fonctionne. Cela se fait en
          arrière-plan (quelques minutes) ; vous pouvez continuer à utiliser l'outil.
        </p>
        <div className="row">
          {ocr?.running ? (
            <>
              <div className="progress" style={{ flex: 1, minWidth: 200 }}>
                <div style={{ width: `${(ocr.done / ocr.total) * 100}%` }} />
              </div>
              <span>
                {ocr.done}/{ocr.total}
              </span>
            </>
          ) : ocrPending ? (
            <button className="btn blue" onClick={() => runOcr()}>
              Lancer la lecture ({ocrPending} carte(s))
            </button>
          ) : (
            <span className="muted">{cardCount ? '✓ Toutes les cartes sont lues.' : 'Aucune carte pour le moment.'}</span>
          )}
        </div>
      </div>

      {!ONLINE && (
      <div className="panel stack">
        <h2>3. Données de démonstration</h2>
        <p className="muted" style={{ margin: 0 }}>
          Crée deux classes fictives (4e A et 4e B, 28 élèves chacune), des séquences construites à partir de vos thèmes, et
          simule 30 jours de révisions pour voir les statistiques.
        </p>
        <div className="row">
          <button className="btn primary" onClick={demoData} disabled={!cardCount || !!demo || !!busy}>
            {demo ? '✓ Données de démo créées' : 'Générer les données de démo'}
          </button>
          <button
            className="btn danger"
            onClick={() => confirm('Effacer toutes les données de FoxBox dans ce navigateur ?') && resetAll()}
          >
            Tout effacer
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
