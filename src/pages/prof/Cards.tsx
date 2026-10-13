import { useState } from 'react';
import { CardBrowser } from '../../components/CardBrowser';
import { CardDetail } from '../../components/CardDetail';
import { db, uid, SUBJECTS } from '../../lib/db';
import { cardCode, defaultOrigin } from '../../lib/cardCodes';

export function Cards({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState<{ id: string; edit: boolean; ids?: string[] } | null>(null);

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
      <CardBrowser onOpen={(c, ids) => setOpen({ id: c.id, edit: false, ids })} onCreate={create} />
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
