// Onglet Physifox : relire et publier les chapitres, valider les flashcards rédigées, suivre les visiteurs et leurs messages.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, uid, fileBlob, type CardDraft, type PfChapter, type PfNotion, type PfSection } from '../../lib/db';
import { ensureSeed, setDraftStatus, validateDraft, visitorStats } from '../../lib/physifox';
import { usePfAdmin } from '../../lib/physifoxAdmin';
import { TabBar } from '../../components/TabBar';
import { CardFace } from '../../components/CardFace';
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
    const links = await db.pfCardNotions.toArray();
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
      <div className="panel stack">
        <div className="panel-title">Notions et flashcards rattachées</div>
        {own.map((n) => <NotionCards key={n.id} notion={n} />)}
      </div>
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

function DraftReview({ d, left, notions }: { d: CardDraft; left: number; notions: PfNotion[] }) {
  const [front, setFront] = useState(d.front);
  const [back, setBack] = useState(d.back);
  async function validate() {
    await validateDraft(d, front, back);
    toast('Flashcard validée');
  }
  function discard() {
    setDraftStatus(d, 'ecartee');
    toast('Flashcard écartée', { undo: () => setDraftStatus(d, 'attente') });
  }
  return (
    <div className="stack">
      <div className="small muted">
        Encore {left} · {d.notionIds.map((id) => notions.find((n) => n.id === id)?.title).join(', ')} · {d.level} · {d.theme}
      </div>
      <div className="pf-draft">
        <div className="panel stack">
          <div className="panel-title">Question</div>
          <textarea rows={4} value={front} onChange={(e) => setFront(e.target.value)} aria-label="Question" />
          <div className="panel calm"><CardFace html={front} /></div>
        </div>
        <div className="panel stack">
          <div className="panel-title">Réponse</div>
          <textarea rows={4} value={back} onChange={(e) => setBack(e.target.value)} aria-label="Réponse" />
          <div className="panel calm"><CardFace html={back} /></div>
        </div>
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
