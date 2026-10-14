import { useState } from 'react';
import { CardBrowser } from '../../components/CardBrowser';
import { CardDetail } from '../../components/CardDetail';
import { db, uid, SUBJECTS, type Card } from '../../lib/db';
import { cardCode, defaultOrigin, loadOrigins } from '../../lib/cardCodes';
import { askForm, showInfo } from '../../components/Dialog';
import { useAuth } from '../../lib/auth';
import { toast } from '../../components/Toast';

export function Cards({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState<{ id: string; edit: boolean; ids?: string[] } | null>(null);
  const { session } = useAuth();
  const [exporting, setExporting] = useState<string | null>(null);

  // Export Anki des flashcards affichées, rangées en sous-paquets selon l'organisation choisie
  async function exportAnki(cards: Card[]) {
    const r = await askForm(
      `Exporter ${cards.length} flashcard(s) pour Anki`,
      [
        {
          key: 'mode',
          label: 'Rangement dans Anki',
          options: [
            { value: 'niveau', label: 'Niveau › Thème › Origine (ex. 4e › 3 Énergie › MM)' },
            { value: 'progression', label: 'Niveau › Séquence › Séance (ordre de la progression)' },
          ],
        },
      ],
      'Exporter',
    );
    if (!r) return;
    setExporting('Préparation…');
    try {
      const { exportApkg } = await import('../../lib/apkgExport');
      const res = await exportApkg(cards, r.mode as 'niveau' | 'progression', await loadOrigins(session!.id), setExporting);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.blob);
      a.download = `FoxBox_${r.mode === 'niveau' ? 'par-niveau' : 'par-sequence'}_${new Date().toISOString().slice(0, 10)}.apkg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      toast(`${cards.length} flashcard(s) exportée(s) dans ${res.decks} paquet(s)` + (res.missing ? ` · ${res.missing} image(s) introuvable(s)` : ''), { error: res.missing > 0 });
    } catch (e) {
      await showInfo("L'export a échoué", (e as Error).message);
    } finally {
      setExporting(null);
    }
  }

  async function create() {
    const now = Date.now();
    const id = uid();
    await db.cards.put({
      id,
      code: await cardCode({ origin: defaultOrigin() }),
      origin: defaultOrigin(),
      subject: SUBJECTS[0],
      tags: [],
      front: '',
      back: '',
      createdAt: now,
      updatedAt: now,
      ocrDone: true,
    });
    setOpen({ id, edit: true });
  }

  return (
    <div className={embedded ? 'stack' : 'page stack'}>
      <div className="spread">
        <h1 className="title" style={{ margin: 0, visibility: embedded ? 'hidden' : undefined }}>Flashcards</h1>
        <button className="btn primary" onClick={create}>
          + Nouvelle flashcard
        </button>
      </div>
      {exporting && <div className="notice">Export Anki en cours : {exporting}</div>}
      <CardBrowser onOpen={(c, ids) => setOpen({ id: c.id, edit: false, ids })} onCreate={create} onExport={exportAnki} />
      {open && (
        <CardDetail
          key={open.id}
          cardId={open.id}
          startEditing={open.edit}
          siblings={open.ids}
          onNavigate={(id, edit) => setOpen({ ...open, id, edit })}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
