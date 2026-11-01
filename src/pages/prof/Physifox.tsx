// Onglet Physifox : relire et publier les chapitres, valider les flashcards rédigées, suivre les visiteurs et leurs messages.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, uid, fileBlob, SUBJECTS, type Card, type CardDraft, type PfChapter, type PfNotion, type PfSection } from '../../lib/db';
import { cardCode } from '../../lib/cardCodes';
import { ensureSeed, setDraftStatus, validateDraft, visitorStats } from '../../lib/physifox';
import { usePfAdmin } from '../../lib/physifoxAdmin';
import { TabBar } from '../../components/TabBar';
import { CardFace } from '../../components/CardFace';
import { CardDetail, FaceEditor } from '../../components/CardDetail';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/Toast';
import { PfSectionView, PfThread } from '../physifox/Public';

const TABS = [
  ['chapitres', 'Chapitres'],
  ['validation', 'Validation'],
  ['visiteurs', 'Visiteurs'],
  ['messages', 'Messages'],
] as const;
type Tab = (typeof TABS)[number][0];

const STATUS: Record<PfChapter['status'], [string, string]> = {
  'a-faire': ['À rédiger', 'bad'],
  brouillon: ['À relire', 'warn'],
  pret: ['Relu', 'ok'],
};
const folded = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Physifox() {
  const { session } = useAuth();
  const admin = usePfAdmin(session?.id);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('onglet') as Tab) || 'chapitres';
  useEffect(() => {
    if (admin && session) ensureSeed(session.id);
  }, [admin, session]);
  const pending = useLiveQuery(() => db.cardDrafts.where('status').equals('attente').count(), [], 0);
  const unread = useLiveQuery(async () => (await db.pfMessages.toArray()).filter((m) => m.authorId === m.visitorId && !m.readByProf).length, [], 0);
  const tabs = useMemo(
    () => TABS.map(([k, l]) => [k, k === 'validation' && pending ? `${l} (${pending})` : k === 'messages' && unread ? `${l} (${unread})` : l] as const),
    [pending, unread],
  );
  if (!admin) return <div className="page"><p className="muted">Cet onglet est réservé à l’administrateur de Physifox.</p></div>;
  return (
    <div className="page stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>Physifox</h1>
        <div className="row">
          <Link className="btn" to="/physifox"><Icon name="screen" size={16} /> Voir le site</Link>
          <TabBar tabs={tabs} current={tab} onChange={(k) => setParams({ onglet: k }, { replace: true })} />
        </div>
      </div>
      {tab === 'chapitres' && <ChaptersTab />}
      {tab === 'validation' && <ValidationTab />}
      {tab === 'visiteurs' && <VisitorsTab />}
      {tab === 'messages' && <MessagesTab />}
    </div>
  );
}

// ---------- Chapitres ----------

function ChaptersTab() {
  const [openId, setOpenId] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const chapters = (await db.pfChapters.toArray()).sort((a, b) => a.order - b.order);
    const gone = new Set(await db.cards.filter((k) => !!k.deleted).primaryKeys());
    const links = (await db.pfCardNotions.toArray()).filter((l) => !gone.has(l.cardId));
    const notions = await db.pfNotions.toArray();
    return { chapters, links, notions };
  }, []);
  if (!data) return null;
  const open = data.chapters.find((c) => c.id === openId);
  if (open) return <ChapterEditor ch={open} notions={data.notions} onClose={() => setOpenId(null)} />;
  const count = (c: PfChapter) => new Set(data.links.filter((l) => c.notionIds.includes(l.notionId)).map((l) => l.cardId)).size;
  const empty = (c: PfChapter) => c.notionIds.filter((n) => !data.links.some((l) => l.notionId === n)).length;
  return (
    <div className="panel stack">
      <div className="panel-title">Classe de 4e</div>
      {data.chapters.map((c) => (
        <div key={c.id} className="spread pf-row">
          <div>
            <a href="#" onClick={(e) => (e.preventDefault(), setOpenId(c.id))}><b>{c.title}</b></a>
            <div className="small muted">
              {c.theme} · {c.sections.length} parties · {count(c)} flashcards
              {empty(c) > 0 && ` · ${empty(c)} notions sans flashcard`}
            </div>
          </div>
          <div className="row">
            <span className={'tag ' + STATUS[c.status][1]}>{STATUS[c.status][0]}</span>
            {c.published && <span className="tag ok">En ligne</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Flashcards d'un chapitre : celles déjà visibles et celles encore à valider
type Item = { key: string; card?: Card; draft?: CardDraft };
async function chapterItems(ch: PfChapter): Promise<Item[]> {
  const links = await db.pfCardNotions.where('notionId').anyOf(ch.notionIds).toArray();
  const cards = await db.cards.bulkGet([...new Set(links.map((l) => l.cardId))]);
  const drafts = await db.cardDrafts.where('status').equals('attente').toArray();
  return [
    ...cards.flatMap((c) => (c && !c.deleted ? [{ key: c.id, card: c }] : [])),
    ...drafts.filter((d) => d.notionIds.some((n) => ch.notionIds.includes(n))).map((d) => ({ key: d.id, draft: d })),
  ];
}

function ChapterEditor({ ch, notions, onClose }: { ch: PfChapter; notions: PfNotion[]; onClose: () => void }) {
  const save = (patch: Partial<PfChapter>) => db.pfChapters.update(ch.id, { ...patch, updatedAt: Date.now() });
  const setSection = (i: number, patch: Partial<PfSection>) => save({ sections: ch.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const [edit, setEdit] = useState<number | null>(null);
  function togglePublish() {
    const published = !ch.published;
    save({ published });
    toast(published ? 'Chapitre en ligne' : 'Chapitre retiré du site', { undo: () => save({ published: !published }) });
  }
  async function upload(i: number, f: File) {
    const id = `pf-${uid()}`;
    await db.media.put({ id, name: f.name, blob: await fileBlob(f) });
    setSection(i, { imageId: id, imageAlt: f.name });
  }
  function move(i: number, d: number) {
    const s = [...ch.sections];
    const [x] = s.splice(i, 1);
    s.splice(i + d, 0, x);
    save({ sections: s });
  }
  function removeSection(i: number) {
    const before = ch.sections;
    save({ sections: before.filter((_, j) => j !== i) });
    setEdit(null);
    toast('Partie retirée', { undo: () => save({ sections: before }) });
  }
  const own = notions.filter((n) => ch.notionIds.includes(n.id));
  const items = useLiveQuery(() => chapterItems(ch), [ch.id, ch.notionIds.join()], [] as Item[]);
  // Une flashcard validée garde sa place : elle remplace la version à valider
  const keyOf = (id: string) => items.find((x) => x.card?.sourceRef === id)?.key ?? id;
  const sectionItems = (s: PfSection) => [...new Set((s.cardIds ?? []).map(keyOf))].flatMap((k) => items.filter((x) => x.key === k));
  const placed = new Set(ch.sections.flatMap((s) => (s.cardIds ?? []).map(keyOf)));
  const unplaced = items.filter((x) => !placed.has(x.key));
  const [openCard, setOpenCard] = useState<{ id: string; edit: boolean } | null>(null);
  const [openDraft, setOpenDraft] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const draft = items.find((x) => x.draft?.id === openDraft)?.draft;
  function place(key: string, target: string) {
    const without = (s: PfSection) => (s.cardIds ?? []).filter((k) => keyOf(k) !== key);
    save({ sections: ch.sections.map((s) => (s.cardIds?.length || s.id === target ? { ...s, cardIds: s.id === target ? [...without(s), key] : without(s) } : s)) });
  }
  // Notion la plus présente sous cette partie : c'est là qu'on range une flashcard ajoutée ou rattachée
  async function notionOf(s: PfSection) {
    const links = await db.pfCardNotions.where('notionId').anyOf(ch.notionIds).toArray();
    const here = new Set(sectionItems(s).map((x) => x.key));
    const tally = ch.notionIds.map((n) => [n, links.filter((l) => l.notionId === n && here.has(l.cardId)).length] as const);
    return tally.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }
  // Flashcard existante : elle n'est pas modifiée. Déjà dans le chapitre, elle change simplement de partie.
  async function attach(s: PfSection, card: Card) {
    const before = ch.sections;
    const inChapter = items.some((x) => x.key === card.id);
    const linkId = inChapter ? null : `${await notionOf(s)}|${card.id}`;
    if (linkId) await db.pfCardNotions.put({ id: linkId, notionId: linkId.split('|')[0], cardId: card.id });
    await save({ sections: ch.sections.map((x) => {
      const rest = (x.cardIds ?? []).filter((k) => keyOf(k) !== card.id);
      return x.id === s.id ? { ...x, cardIds: [...rest, card.id] } : x.cardIds ? { ...x, cardIds: rest } : x;
    }) });
    toast('Flashcard rattachée à cette partie', {
      undo: () => {
        if (linkId) db.pfCardNotions.delete(linkId);
        save({ sections: before });
      },
    });
  }
  // Nouvelle flashcard : visible dès qu'elle est enregistrée
  async function addCard(s: PfSection) {
    const notionId = await notionOf(s);
    const now = Date.now();
    const base = { level: ch.level, theme: ch.theme, origin: 'ER' };
    const card: Card = { id: uid(), code: await cardCode(base), ...base, subject: SUBJECTS[0], tags: [], front: '', back: '', createdAt: now, updatedAt: now };
    await db.cards.put(card);
    await db.pfCardNotions.put({ id: `${notionId}|${card.id}`, notionId, cardId: card.id });
    await save({ sections: ch.sections.map((x) => (x.id === s.id ? { ...x, cardIds: [...(x.cardIds ?? []), card.id] } : x)) });
    setOpenCard({ id: card.id, edit: true });
  }
  // Fermée sans rien écrire : on ne laisse pas de flashcard vide
  async function closeCard() {
    const c = openCard && (await db.cards.get(openCard.id));
    if (c && !c.deleted && !c.front.trim() && !c.back.trim()) await db.cards.update(c.id, { deleted: true, updatedAt: Date.now() });
    setOpenCard(null);
  }
  const list = (rows: Item[], current: string) =>
    rows.map((x) => (
      <div key={x.key} className="pf-sc-row">
        <CardFace html={(x.card ?? x.draft!).front} />
        <CardFace html={(x.card ?? x.draft!).back} />
        <div className="row pf-sc-tools">
          {x.draft && <span className="tag warn">À valider</span>}
          <button className="btn small" onClick={() => (x.card ? setOpenCard({ id: x.card.id, edit: true }) : setOpenDraft(x.draft!.id))}>
            <Icon name="edit" size={14} /> {x.draft ? 'Relire' : 'Modifier'}
          </button>
          <select className="pf-sc-move" value={current} aria-label="Partie du cours" onChange={(e) => place(x.key, e.target.value)}>
            <option value="">À placer</option>
            {ch.sections.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>
      </div>
    ));
  return (
    <div className="stack">
      <div className="spread">
        <a href="#" className="small muted" onClick={(e) => (e.preventDefault(), onClose())}>← Tous les chapitres</a>
        <div className="row">
          <Link className="btn" to={`/physifox/${ch.slug}`}><Icon name="screen" size={16} /> Aperçu</Link>
          <button className={'btn' + (ch.published ? '' : ' primary')} onClick={togglePublish}>{ch.published ? 'Retirer du site' : 'Mettre en ligne'}</button>
        </div>
      </div>
      <div className="panel stack">
        <label className="field">Titre<input defaultValue={ch.title} onBlur={(e) => save({ title: e.target.value })} /></label>
        <label className="field">Présentation<textarea defaultValue={ch.summary} rows={2} onBlur={(e) => save({ summary: e.target.value })} /></label>
        <label className="field">
          Avancement
          <select value={ch.status} onChange={(e) => save({ status: e.target.value as PfChapter['status'] })}>
            <option value="a-faire">À rédiger</option>
            <option value="brouillon">À relire</option>
            <option value="pret">Relu</option>
          </select>
        </label>
      </div>
      {ch.sections.map((s, i) =>
        edit === i ? (
          <div key={s.id} className="panel stack">
            <label className="field">Titre de la partie<input defaultValue={s.title} onBlur={(e) => setSection(i, { title: e.target.value })} /></label>
            <label className="field">
              Type
              <select value={s.kind} onChange={(e) => setSection(i, { kind: e.target.value as PfSection['kind'] })}>
                <option value="cours">Cours</option>
                <option value="rappel">Rappel</option>
                <option value="methode">Méthode</option>
                <option value="exercice">Exercice</option>
                <option value="experience">Expérience</option>
              </select>
            </label>
            <label className="field">
              Texte <span className="small muted" style={{ fontWeight: 600 }}>**gras**, $formule$, « - » pour une liste, « | a | b | » pour un tableau</span>
              <textarea defaultValue={s.body} rows={12} onBlur={(e) => setSection(i, { body: e.target.value })} />
            </label>
            <label className="field">Image<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(i, e.target.files[0])} /></label>
            {s.figures?.map((f) => (
              <div key={f.src} className="spread pf-row">
                <img src={f.src} alt={f.alt} style={{ maxHeight: 80, maxWidth: '60%' }} />
                <button className="btn small ghost" onClick={() => setSection(i, { figures: s.figures!.filter((x) => x.src !== f.src) })}>
                  <Icon name="trash" size={14} /> Retirer ce schéma
                </button>
              </div>
            ))}
            <label className="field">Vidéo YouTube (identifiant)<input defaultValue={s.video} onBlur={(e) => setSection(i, { video: e.target.value.trim() || undefined })} /></label>
            <div className="spread">
              <button className="btn primary" onClick={() => setEdit(null)}>Terminé</button>
              <button className="btn ghost" onClick={() => removeSection(i)}><Icon name="trash" size={16} /> Retirer</button>
            </div>
          </div>
        ) : (
          <div key={s.id} className="stack" style={{ gap: 8 }}>
            <PfSectionView s={s} />
            <div className="row">
              <button className="btn small" onClick={() => setEdit(i)}><Icon name="edit" size={14} /> Modifier</button>
              <button className="btn small ghost" disabled={i === 0} onClick={() => move(i, -1)} title="Monter">↑</button>
              <button className="btn small ghost" disabled={i === ch.sections.length - 1} onClick={() => move(i, 1)} title="Descendre">↓</button>
            </div>
            <div className="panel calm stack pf-sc" style={{ gap: 8 }}>
              <div className="spread">
                <b className="small">{sectionItems(s).length ? `Flashcards de cette partie (${sectionItems(s).length})` : 'Aucune flashcard sur cette partie'}</b>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn small" onClick={() => setLinking(linking === s.id ? null : s.id)}><Icon name="link" size={14} /> Rattacher une flashcard</button>
                  <button className="btn small" onClick={() => addCard(s)}><Icon name="plus" size={14} /> Ajouter une flashcard</button>
                </div>
              </div>
              {linking === s.id && <CardSearch exclude={sectionItems(s).map((x) => x.key)} level={ch.level} onPick={(c) => attach(s, c)} onClose={() => setLinking(null)} />}
              {list(sectionItems(s), s.id)}
            </div>
          </div>
        ),
      )}
      <div>
        <button
          className="btn"
          onClick={() => {
            save({ sections: [...ch.sections, { id: uid(), title: 'Nouvelle partie', kind: 'cours', body: '' }] });
            setEdit(ch.sections.length);
          }}
        >
          <Icon name="plus" size={16} /> Ajouter une partie
        </button>
      </div>
      {unplaced.length > 0 && (
        <div className="panel calm stack pf-sc" style={{ gap: 8 }}>
          <b className="small">Flashcards du chapitre à placer ({unplaced.length})</b>
          {list(unplaced, '')}
        </div>
      )}
      {openCard && <CardDetail cardId={openCard.id} startEditing={openCard.edit} onClose={closeCard} />}
      {openDraft && (
        <>
          <div className="drawer-bg light" onClick={() => setOpenDraft(null)} />
          <aside className="drawer left stack">
            <div className="spread">
              <h2 style={{ margin: 0 }}>Flashcard à valider</h2>
              <button className="btn ghost" onClick={() => setOpenDraft(null)}>Fermer</button>
            </div>
            {draft && <DraftReview key={draft.id} d={draft} notions={notions} onDone={() => setOpenDraft(null)} />}
          </aside>
        </>
      )}
      <div className="panel stack">
        <div className="panel-title">Notions et flashcards rattachées</div>
        {own.map((n) => <NotionCards key={n.id} notion={n} />)}
      </div>
    </div>
  );
}

// Recherche dans toutes les flashcards par mot, code ou texte lu dans les images ; celles du niveau du chapitre d'abord
function CardSearch({ exclude, level, onPick, onClose }: { exclude: string[]; level: string; onPick: (c: Card) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const found = useLiveQuery(async () => {
    const words = folded(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const hay = (c: Card) => folded(`${c.code} ${c.sourceRef ?? ''} ${(c.aliases ?? []).join(' ')} ${c.front} ${c.back} ${c.ocrFront ?? ''} ${c.ocrBack ?? ''}`.replace(/<[^>]+>/g, ' '));
    const all = await db.cards.filter((c) => !c.deleted && !exclude.includes(c.id) && words.every((w) => hay(c).includes(w))).toArray();
    return all.sort((a, b) => Number(b.level === level) - Number(a.level === level) || a.code.localeCompare(b.code));
  }, [q, exclude.join(), level], [] as Card[]);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <input autoFocus style={{ flex: 1, minWidth: 0 }} placeholder="Mot-clé ou code de la flashcard" aria-label="Chercher une flashcard" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn small ghost" onClick={onClose}>Fermer</button>
      </div>
      {q.trim() && !found.length && <span className="small muted">Aucune autre flashcard trouvée.</span>}
      {found.length > 30 && <span className="small muted">{found.length} flashcards trouvées, les 30 premières sont affichées : précisez la recherche.</span>}
      {found.slice(0, 30).map((c) => (
        <div key={c.id} className="pf-sc-row">
          <CardFace html={c.front} />
          <CardFace html={c.back} />
          <div className="row pf-sc-tools">
            <span className="small muted">{c.code}</span>
            <button className="btn small" onClick={() => onPick(c)}><Icon name="link" size={14} /> Rattacher</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Rattacher des flashcards à une notion : les flashcards ne sont pas modifiées, elles reçoivent juste ce lien
function NotionCards({ notion }: { notion: PfNotion }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const links = useLiveQuery(() => db.pfCardNotions.where('notionId').equals(notion.id).toArray(), [notion.id], []);
  const found = useLiveQuery(async () => {
    if (!open) return [];
    const words = q.trim() ? [folded(q.trim())] : (notion.keywords ?? []).map(folded);
    const all = await db.cards.toArray();
    const hay = (c: (typeof all)[number]) => folded(`${c.code} ${c.sourceRef ?? ''} ${c.front.replace(/<[^>]+>/g, ' ')} ${c.back.replace(/<[^>]+>/g, ' ')}`);
    return all
      .filter((c) => !c.deleted && (q.trim() || !c.level || c.level === '4e' || notion.levels.includes(c.level)) && words.some((w) => hay(c).includes(w)))
      .slice(0, 40);
  }, [open, q, notion.id], []);
  const linked = new Set(links.map((l) => l.cardId));
  const toggle = (cardId: string) => {
    const id = `${notion.id}|${cardId}`;
    if (linked.has(cardId)) db.pfCardNotions.delete(id);
    else db.pfCardNotions.put({ id, notionId: notion.id, cardId });
  };
  return (
    <div className="pf-row stack" style={{ gap: 8 }}>
      <div className="spread">
        <div>
          <b>{notion.title}</b>
          <div className="small muted">{notion.programme}{notion.sequences?.length ? ` · ${notion.sequences.join(', ')}` : ''}</div>
        </div>
        <div className="row">
          <span className={'tag ' + (links.length ? 'ok' : 'warn')}>{links.length} flashcards</span>
          <button className="btn small" onClick={() => setOpen(!open)}>{open ? 'Fermer' : 'Rattacher'}</button>
        </div>
      </div>
      {open && (
        <div className="stack" style={{ gap: 8 }}>
          <input placeholder="Chercher une flashcard (par défaut : mots-clés de la notion)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher une flashcard" />
          {!found.length && <span className="small muted">Aucune flashcard trouvée.</span>}
          {found.map((c) => (
            <label key={c.id} className="row pf-pick">
              <input type="checkbox" checked={linked.has(c.id)} onChange={() => toggle(c.id)} />
              <span className="small muted">{c.code}</span>
              <CardFace html={c.front} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Validation des flashcards ----------

function ValidationTab() {
  const drafts = useLiveQuery(() => db.cardDrafts.where('status').equals('attente').sortBy('id'), [], [] as CardDraft[]);
  const notions = useLiveQuery(() => db.pfNotions.toArray(), [], [] as PfNotion[]);
  const [started, setStarted] = useState(false);
  const d = drafts[0];
  if (!drafts.length) return <div className="panel">Aucune flashcard en attente de validation.</div>;
  if (!started)
    return (
      <div className="panel spread">
        <span><b>{drafts.length} nouvelles flashcards</b> à valider. Elles restent invisibles tant que vous ne les avez pas validées.</span>
        <button className="btn primary" onClick={() => setStarted(true)}>Passer en revue</button>
      </div>
    );
  return <DraftReview key={d.id} d={d} left={drafts.length} notions={notions} />;
}

function DraftReview({ d, left, notions, onDone }: { d: CardDraft; left?: number; notions: PfNotion[]; onDone?: () => void }) {
  const [front, setFront] = useState(d.front);
  const [back, setBack] = useState(d.back);
  async function validate() {
    await validateDraft(d, front, back);
    toast('Flashcard validée');
    onDone?.();
  }
  function discard() {
    setDraftStatus(d, 'ecartee');
    toast('Flashcard écartée', { undo: () => setDraftStatus(d, 'attente') });
    onDone?.();
  }
  return (
    <div className="stack">
      <div className="small muted">
        {left ? `Encore ${left} · ` : ''}{d.notionIds.map((id) => notions.find((n) => n.id === id)?.title).join(', ')} · {d.level} · {d.theme}
      </div>
      {/* Mêmes outils que pour une flashcard : formules, gras, images collées ; une image est gardée aussitôt */}
      <div className="panel stack">
        <FaceEditor label="Question" html={front} onChange={setFront} onImage={(h) => (setFront(h), db.cardDrafts.update(d.id, { front: h }))} />
      </div>
      <div className="panel stack">
        <FaceEditor label="Réponse" html={back} onChange={setBack} onImage={(h) => (setBack(h), db.cardDrafts.update(d.id, { back: h }))} />
      </div>
      {d.source && <div className="small muted">Source : {d.source}</div>}
      <div className="row">
        <button className="btn primary" onClick={validate}><Icon name="check" size={16} /> Valider</button>
        <button className="btn ghost" onClick={discard}><Icon name="x" size={16} /> Écarter</button>
      </div>
    </div>
  );
}

// ---------- Visiteurs ----------

function VisitorsTab() {
  const s = useLiveQuery(() => visitorStats(), []);
  if (!s) return null;
  const when = (ts: number) => (ts ? new Date(ts).toLocaleDateString('fr-FR') : '—');
  return (
    <div className="stack">
      <div className="pf-grid">
        <div className="panel calm"><div className="title-num">{s.total}</div><span className="small muted">visiteurs inscrits</span></div>
        <div className="panel calm"><div className="title-num">{s.active}</div><span className="small muted">actifs sur 7 jours</span></div>
        <div className="panel calm"><div className="title-num">{s.reviews}</div><span className="small muted">flashcards révisées</span></div>
      </div>
      <div className="panel stack">
        <div className="panel-title">Visiteurs</div>
        {!s.rows.length ? (
          <span className="muted">Personne pour l’instant.</span>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pf-table">
              <thead>
                <tr><th>Pseudo</th><th>E-mail</th><th>Classe</th><th>Établissement</th><th>Pays</th><th>Inscription</th><th>Deck</th><th>Révisions</th><th>Ratées</th><th>Dernière activité</th></tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.visitor.id}>
                    <td>{r.visitor.pseudo}</td><td>{r.visitor.email}</td><td>{r.visitor.classe ?? ''}</td><td>{r.visitor.school ?? ''}</td><td>{r.visitor.country ?? ''}</td>
                    <td>{when(r.visitor.createdAt)}</td><td>{r.deck}</td><td>{r.reviews}</td><td>{r.reviews ? Math.round((100 * r.forgot) / r.reviews) + ' %' : '—'}</td><td>{when(r.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {s.hard.length > 0 && (
        <div className="panel stack">
          <div className="panel-title">Flashcards les plus ratées</div>
          {s.hard.map((h) => (
            <div key={h.id} className="spread pf-row">
              {h.card && <CardFace html={h.card.front} />}
              <span className="tag bad">{Math.round((100 * h.forgot) / h.n)} % sur {h.n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Messages ----------

function MessagesTab() {
  const { session } = useAuth();
  const [sel, setSel] = useState<string | null>(null);
  const threads = useLiveQuery(async () => {
    const ms = await db.pfMessages.toArray();
    const ids = [...new Set(ms.map((m) => m.visitorId))];
    const vs = await db.visitors.bulkGet(ids);
    return ids
      .map((id, i) => {
        const mine = ms.filter((m) => m.visitorId === id);
        return { id, name: vs[i]?.pseudo ?? 'Visiteur', last: Math.max(...mine.map((m) => m.createdAt)), unread: mine.filter((m) => m.authorId === id && !m.readByProf).length, signals: mine.filter((m) => m.cardId).length };
      })
      .sort((a, b) => b.last - a.last);
  }, [], []);
  if (!threads.length) return <div className="panel">Aucun message pour l’instant.</div>;
  const current = sel ?? threads[0].id;
  return (
    <div className="pf-inbox">
      <div className="panel stack" style={{ gap: 8 }}>
        {threads.map((t) => (
          <a key={t.id} href="#" className={'pf-row' + (t.id === current ? ' pf-sel' : '')} onClick={(e) => (e.preventDefault(), setSel(t.id))}>
            <b>{t.name}</b> {t.unread > 0 && <span className="badge">{t.unread}</span>}
            <div className="small muted">{t.signals > 0 ? `${t.signals} signalement(s) · ` : ''}{new Date(t.last).toLocaleDateString('fr-FR')}</div>
          </a>
        ))}
      </div>
      <div className="panel"><PfThread key={current} visitorId={current} authorId={session!.id} side="prof" /></div>
    </div>
  );
}
