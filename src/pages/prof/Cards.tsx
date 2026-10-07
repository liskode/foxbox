import { useState } from 'react';
import { CardBrowser } from '../../components/CardBrowser';
import { CardDetail } from '../../components/CardDetail';
import { db, uid, nextCardCode, SUBJECTS } from '../../lib/db';

export function Cards() {
  const [open, setOpen] = useState<{ id: string; edit: boolean } | null>(null);

  async function create() {
    const now = Date.now();
    const id = uid();
    await db.cards.put({
      id,
      code: await nextCardCode(),
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
    <div className="page stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>Cartes</h1>
        <button className="btn primary" onClick={create}>
          + Nouvelle carte
        </button>
      </div>
      <CardBrowser onOpen={(c) => setOpen({ id: c.id, edit: false })} />
      {open && <CardDetail cardId={open.id} startEditing={open.edit} onClose={() => setOpen(null)} />}
    </div>
  );
}
