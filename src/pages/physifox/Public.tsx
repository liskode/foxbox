// Physifox, site public : accueil, chapitres, inscription, connexion, Deck, entraînement, messages, compte.
// Les chapitres publiés se lisent sans compte ; le Deck et les messages demandent une inscription.
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, uid, type Card, type PfChapter, type PfSection, type Rating } from '../../lib/db';
import { ONLINE, supabase } from '../../lib/supabase';
import { addChapterToDeck, chapterCardIds, deckSession, loadPublic, proseHtml, recordDeckAnswer, sendPfMessage } from '../../lib/physifox';
import { CardFace, mediaUrl } from '../../components/CardFace';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/Toast';
import { ask } from '../../components/Dialog';
import { usePfSiteOpen } from '../../lib/physifoxSite';
import { usePfAdmin } from '../../lib/physifoxAdmin';

const THEME_ORDER = ['Matière', 'Mouvement', 'Énergie', 'Signaux', 'Méthodes'];
const THEME_CLASS: Record<string, string> = { Matière: 't-Matière', Mouvement: 't-Mouvement', Énergie: 't-Énergie', Signaux: 't-Signaux', Méthodes: 't-Outils' };
const SECTION_LABEL: Record<PfSection['kind'], string> = { cours: 'Cours', rappel: 'Rappel', methode: 'Méthode', exercice: 'Exercice', experience: 'Expérience' };

// Cadre commun : en-tête, et menu en bas de l'écran sur téléphone
export function PfShell({ children, needAccount }: { children: ReactNode; needAccount?: boolean }) {
  const { session, ready, logout } = useAuth();
  const visitor = session?.role === 'visiteur';
  // Site fermé (contenus en cours de révision) : seul l'administrateur le voit
  const open = usePfSiteOpen();
  const admin = usePfAdmin(session?.id) && !!session;
  const closed = open === false && !admin;
  useEffect(() => {
    if (!closed) loadPublic();
  }, [closed]);
  if (!ready || open === null) return null;
  if (needAccount && !visitor) return <Navigate to={session ? '/' : '/physifox/connexion'} replace />;
  return (
    <div className="eleve-shell pf-shell">
      <header className="topbar noprint">
        <Link to="/physifox" className="brand" title="Accueil de Physifox">
          <img src="./logo.png" alt="" />
          <span>Physifox</span>
        </Link>
        <nav className="nav">
          <NavLink to="/physifox" end>Cours</NavLink>
          {visitor && <NavLink to="/physifox/deck">Mon Deck</NavLink>}
          {visitor && <NavLink to="/physifox/messages">Messages</NavLink>}
          {visitor && <NavLink to="/physifox/compte">Mon compte</NavLink>}
        </nav>
        {visitor ? (
          <button className="btn small ghost" onClick={logout}>Déconnexion</button>
        ) : !session ? (
          <Link className="btn small" to="/physifox/connexion">Se connecter</Link>
        ) : (
          <Link className="btn small" to="/">FoxBox</Link>
        )}
      </header>
      {open === false && admin && <div className="demo-banner noprint">Site fermé au public — réouverture dans Réglages › Modules</div>}
      {closed ? (
        <div className="page narrow stack" style={{ textAlign: 'center', alignItems: 'center', paddingTop: 48 }}>
          <img src="./logo.png" alt="" style={{ width: 120 }} />
          <h1 className="title">Bientôt de retour</h1>
          <p>Physifox est en cours de mise à jour. Les cours et les flashcards reviennent très vite.</p>
        </div>
      ) : (
        children
      )}
      <footer className="pf-footer noprint small muted">
        <Link to="/physifox/confidentialite">Confidentialité</Link> · E. Renard
      </footer>
      <nav className="bottom-nav noprint">
        <NavLink to="/physifox" end><Icon name="file" size={22} />Cours</NavLink>
        {visitor ? (
          <>
            <NavLink to="/physifox/deck"><Icon name="cards" size={22} />Deck</NavLink>
            <NavLink to="/physifox/messages"><Icon name="message" size={22} />Messages</NavLink>
            <NavLink to="/physifox/compte"><Icon name="user" size={22} />Compte</NavLink>
          </>
        ) : (
          <NavLink to="/physifox/connexion"><Icon name="user" size={22} />Connexion</NavLink>
        )}
      </nav>
    </div>
  );
}

const usePublished = () =>
  useLiveQuery(async () => (await db.pfChapters.toArray()).filter((c) => c.published).sort((a, b) => a.order - b.order), [], [] as PfChapter[]);

export function PfHome() {
  const { session } = useAuth();
  const chapters = usePublished();
  return (
    <div className="page stack">
      <div className="panel calm pf-hero">
        <img src="./logo.png" alt="" />
        <div>
          <h1 className="title" style={{ margin: 0 }}>Physifox</h1>
          <p style={{ margin: '8px 0' }}>
            Je m’appelle Etienne Renard et j’enseigne la physique-chimie. Vous trouverez ici mes cours, et des flashcards pour tout retenir, un peu chaque jour.
          </p>
          {!session && (
            <Link className="btn primary" to="/physifox/inscription">Créer un compte gratuit</Link>
          )}
        </div>
      </div>
      <h2 className="panel-title" style={{ margin: 0 }}>Classe de 4e</h2>
      {!chapters.length && <p className="muted">Les chapitres arrivent bientôt.</p>}
      {THEME_ORDER.map((t) => {
        const list = chapters.filter((c) => c.theme === t);
        if (!list.length) return null;
        return (
          <section key={t} className="stack" style={{ gap: 8 }}>
            <div><span className={'chip ' + THEME_CLASS[t]}>{t}</span></div>
            <div className="pf-grid">
              {list.map((c) => (
                <Link key={c.id} to={`/physifox/${c.slug}`} className="panel strong pf-tile">
                  <b>{c.title}</b>
                  <span className="small muted">{c.summary}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function PfProse({ text }: { text: string }) {
  return <div className="pf-prose"><CardFace html={proseHtml(text)} /></div>;
}

function SectionImage({ s }: { s: PfSection }) {
  const [src, setSrc] = useState(s.imageSrc ?? '');
  useEffect(() => {
    if (s.imageId) mediaUrl(s.imageId).then((u) => u && setSrc(u));
  }, [s.imageId]);
  return src ? <img src={src} alt={s.imageAlt ?? ''} className="pf-figure" /> : null;
}

export function PfSectionView({ s }: { s: PfSection }) {
  return (
    <section id={s.id} className="panel stack" style={{ gap: 8 }}>
      <div className="spread">
        <h2 className="panel-title" style={{ margin: 0 }}>{s.title}</h2>
        <span className="small muted">{SECTION_LABEL[s.kind]}</span>
      </div>
      <PfProse text={s.body} />
      <SectionImage s={s} />
      {/* Sur téléphone, un schéma détaillé s'ouvre en grand d'un appui */}
      {s.figures?.map((f) => (
        <a key={f.src} href={f.src} target="_blank" rel="noreferrer">
          <img src={f.src} alt={f.alt} title={f.alt} className="pf-figure" loading="lazy" />
        </a>
      ))}
      {s.video && (
        <iframe
          className="pf-video"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(s.video)}`}
          title={s.title}
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
        />
      )}
    </section>
  );
}

export function PfChapterPage() {
  const { slug } = useParams();
  const { session } = useAuth();
  const nav = useNavigate();
  const ch = useLiveQuery(() => db.pfChapters.where('slug').equals(slug!).first(), [slug]);
  const info = useLiveQuery(async () => {
    if (!ch) return { total: 0, inDeck: 0 };
    const ids = await chapterCardIds(ch);
    const have = session?.role === 'visiteur' ? await db.pfDeck.bulkGet(ids.map((id) => `${session.id}|${id}`)) : [];
    return { total: ids.length, inDeck: have.filter(Boolean).length };
  }, [ch?.id, ch?.notionIds.join(), session?.id], { total: 0, inDeck: 0 });

  if (!ch) return <div className="page"><p className="muted">Chargement du chapitre…</p></div>;
  // Le professeur peut relire un chapitre avant de le publier
  if (!ch.published && session?.role !== 'prof') return <div className="page"><p className="muted">Ce chapitre n’est pas encore en ligne.</p></div>;

  async function add() {
    if (session?.role !== 'visiteur') return nav('/physifox/inscription');
    const added = await addChapterToDeck(session.id, ch!);
    toast(added.length ? `${added.length} flashcards ajoutées à votre Deck` : 'Ces flashcards sont déjà dans votre Deck', {
      undo: added.length ? () => db.pfDeck.bulkDelete(added) : undefined,
    });
  }
  const complete = info.total > 0 && info.inDeck >= info.total;

  return (
    <div className="page stack">
      <Link to="/physifox" className="small muted">← Tous les chapitres</Link>
      <h1 className="title" style={{ margin: 0 }}>{ch.title}</h1>
      <p style={{ margin: 0 }}>{ch.summary}</p>
      {!ch.published && <div><span className="tag warn">Aperçu : pas encore en ligne</span></div>}
      <div className="panel calm spread">
        <span>
          <b>{info.total} flashcards</b> pour retenir ce chapitre
          {info.inDeck > 0 && !complete && <span className="muted"> · {info.inDeck} déjà dans votre Deck</span>}
        </span>
        {complete ? (
          <Link className="btn" to="/physifox/deck"><Icon name="check" size={16} /> Dans votre Deck</Link>
        ) : (
          <button className="btn primary" onClick={add} disabled={!info.total}>
            <Icon name="plus" size={16} /> Ajouter les flashcards
          </button>
        )}
      </div>
      {!ch.sections.length && <p className="muted">Le cours de ce chapitre arrive bientôt.</p>}
      {ch.sections.map((s) => <PfSectionView key={s.id} s={s} />)}
    </div>
  );
}

// ---------- Compte ----------

export function PfSignup() {
  const { session, localVisitorLogin } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ pseudo: '', email: '', password: '', classe: '', school: '', country: '', ok: false });
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  if (session?.role === 'visiteur') return <Navigate to="/physifox/deck" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (f.password.length < 8) return setErr('Mot de passe : 8 caractères minimum.');
    const email = f.email.trim().toLowerCase();
    const extras = { classe: f.classe.trim() || undefined, school: f.school.trim() || undefined, country: f.country.trim() || undefined };
    setBusy(true);
    if (ONLINE) {
      const { error } = await supabase.auth.signUp({
        email,
        password: f.password,
        options: {
          data: { pf_visitor: 'true', pseudo: f.pseudo.trim(), ...extras },
          emailRedirectTo: location.origin + location.pathname,
        },
      });
      setBusy(false);
      if (error) return setErr('Inscription impossible. Vérifiez votre adresse, ou connectez-vous si vous avez déjà un compte.');
      setSent(true);
      return;
    }
    if (await db.visitors.where('email').equals(email).first()) {
      setBusy(false);
      return setErr('Un compte existe déjà avec cette adresse.');
    }
    const id = uid();
    await db.visitors.add({ id, email, pseudo: f.pseudo.trim(), ...extras, createdAt: Date.now(), password: f.password });
    setBusy(false);
    localVisitorLogin(id);
    nav('/physifox');
  }

  if (sent)
    return (
      <div className="page narrow stack">
        <h1 className="title">Presque fini</h1>
        <div className="panel">Ouvrez le lien de confirmation reçu à l’adresse <b>{f.email}</b>, puis connectez-vous.</div>
      </div>
    );
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>Inscription</h1>
      <p className="muted" style={{ margin: 0 }}>Gratuit. Un pseudo suffit : inutile de donner votre vrai nom.</p>
      <form className="panel stack" onSubmit={submit}>
        <label className="field">Nom ou pseudo<input value={f.pseudo} onChange={set('pseudo')} maxLength={40} required /></label>
        <label className="field">Adresse e-mail<input type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></label>
        <label className="field">Mot de passe (8 caractères minimum)<input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" required /></label>
        <div className="panel-title" style={{ marginTop: 8 }}>Facultatif</div>
        <label className="field">Classe<input value={f.classe} onChange={set('classe')} maxLength={40} placeholder="4e" /></label>
        <label className="field">Établissement<input value={f.school} onChange={set('school')} maxLength={80} /></label>
        <label className="field">Pays<input value={f.country} onChange={set('country')} maxLength={60} /></label>
        <label className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
          <input type="checkbox" required checked={f.ok} onChange={(e) => setF({ ...f, ok: e.target.checked })} />
          <span className="small">J’ai lu la <Link to="/physifox/confidentialite">page de confidentialité</Link>. Si j’ai moins de 15 ans, un parent est d’accord pour cette inscription.</span>
        </label>
        {err && <div className="tag bad">{err}</div>}
        <button className="btn primary big" disabled={busy}>Créer mon compte</button>
        <span className="small muted">Déjà inscrit ? <Link to="/physifox/connexion">Se connecter</Link></span>
      </form>
    </div>
  );
}

export function PfLogin() {
  const { session, login } = useAuth();
  const [l, setL] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  if (session?.role === 'visiteur') return <Navigate to="/physifox/deck" replace />;
  if (session) return <Navigate to="/" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const s = await login(l.trim(), p);
    if ('error' in s) setErr('Adresse e-mail ou mot de passe incorrect, ou adresse pas encore confirmée.');
  }
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>Connexion</h1>
      <form className="panel stack" onSubmit={submit}>
        <label className="field">Adresse e-mail<input type="email" value={l} onChange={(e) => setL(e.target.value)} autoComplete="username" required /></label>
        <label className="field">Mot de passe<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></label>
        {err && <div className="tag bad">{err}</div>}
        <button className="btn primary big">Se connecter</button>
        <span className="small muted">Pas encore de compte ? <Link to="/physifox/inscription">S’inscrire</Link></span>
      </form>
    </div>
  );
}

export function PfAccount() {
  const { session, logout } = useAuth();
  const v = useLiveQuery(() => db.visitors.get(session!.id), [session?.id]);
  if (!v) return null;
  const save = (k: 'pseudo' | 'classe' | 'school' | 'country') => (e: { target: { value: string } }) => {
    const value = e.target.value.trim();
    if (k === 'pseudo' && !value) return;
    if (value !== (v[k] ?? '')) db.visitors.update(v.id, { [k]: value || undefined }).then(() => toast('Enregistré'));
  };
  async function remove() {
    const typed = await ask('Supprimer votre compte, votre Deck et vos messages ? Écrivez SUPPRIMER pour confirmer.');
    if (typed?.trim().toUpperCase() !== 'SUPPRIMER') return;
    if (ONLINE) {
      const { error } = await supabase.rpc('pf_delete_my_account');
      if (error) return toast('Suppression impossible : réessayez plus tard.', { error: true });
    } else {
      await Promise.all([
        db.pfDeck.where('visitorId').equals(v!.id).delete(),
        db.pfReviews.where('visitorId').equals(v!.id).delete(),
        db.pfMessages.where('visitorId').equals(v!.id).delete(),
        db.visitors.delete(v!.id),
      ]);
    }
    await logout();
  }
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>Mon compte</h1>
      <div className="panel stack">
        <div className="small muted">Adresse e-mail : {v.email}</div>
        <label className="field">Nom ou pseudo<input defaultValue={v.pseudo} onBlur={save('pseudo')} maxLength={40} /></label>
        <label className="field">Classe (facultatif)<input defaultValue={v.classe} onBlur={save('classe')} maxLength={40} /></label>
        <label className="field">Établissement (facultatif)<input defaultValue={v.school} onBlur={save('school')} maxLength={80} /></label>
        <label className="field">Pays (facultatif)<input defaultValue={v.country} onBlur={save('country')} maxLength={60} /></label>
      </div>
      <div><button className="btn" onClick={logout}><Icon name="logout" size={16} /> Se déconnecter</button></div>
      <div className="panel calm stack">
        <div className="panel-title">Supprimer mon compte</div>
        <span className="small">Votre fiche, votre Deck, votre historique et vos messages sont effacés définitivement.</span>
        <div><button className="btn" onClick={remove}><Icon name="trash" size={16} /> Supprimer mon compte</button></div>
      </div>
    </div>
  );
}

export function PfPrivacy() {
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>Confidentialité</h1>
      <div className="panel stack">
        <div>
          <div className="panel-title">Ce qui est enregistré</div>
          <p>Votre adresse e-mail et votre nom ou pseudo. Si vous le souhaitez : classe, établissement et pays. Puis votre Deck, vos réponses aux flashcards et vos messages.</p>
        </div>
        <div>
          <div className="panel-title">Pourquoi</div>
          <p>Pour faire fonctionner votre compte et votre entraînement, répondre à vos messages et améliorer les cours et les flashcards. Aucune publicité, aucune revente.</p>
        </div>
        <div>
          <div className="panel-title">Qui peut voir ces informations</div>
          <p>Vous, et Etienne Renard, professeur et auteur du site. Elles sont hébergées chez Supabase, le service technique du site.</p>
        </div>
        <div>
          <div className="panel-title">Vos droits</div>
          <p>Vous pouvez corriger vos informations et supprimer votre compte à tout moment depuis « Mon compte ». Pour toute question, écrivez depuis la messagerie du site.</p>
        </div>
        <div>
          <div className="panel-title">Élèves de moins de 15 ans</div>
          <p>L’accord d’un parent est demandé à l’inscription. Un pseudo suffit : ne donnez pas d’informations personnelles dans les messages.</p>
        </div>
      </div>
    </div>
  );
}

// ---------- Deck et entraînement ----------

export function PfDeck() {
  const { session } = useAuth();
  const data = useLiveQuery(async () => {
    const s = await deckSession(session!.id);
    const chapters = await db.pfChapters.toArray();
    const reviews = await db.pfReviews.where('visitorId').equals(session!.id).toArray();
    const perChapter = chapters
      .map((c) => {
        const cards = s.deck.filter((d) => d.chapterId === c.id);
        return { c, n: cards.length, learned: cards.filter((d) => d.box >= 4).length };
      })
      .filter((x) => x.n)
      .sort((a, b) => a.c.order - b.c.order);
    return { ...s, perChapter, reviews: reviews.length };
  }, [session?.id]);
  if (!data) return null;
  return (
    <div className="page stack">
      <h1 className="title" style={{ margin: 0 }}>Mon Deck</h1>
      {!data.deck.length ? (
        <div className="panel stack">
          <span>Votre Deck est vide. Ouvrez un chapitre et cliquez sur « Ajouter les flashcards ».</span>
          <div><Link className="btn primary" to="/physifox">Voir les cours</Link></div>
        </div>
      ) : (
        <>
          <div className="panel calm spread">
            <span>
              <b>{data.queue.length ? `${data.queue.length} flashcards aujourd’hui` : 'Objectif du jour atteint'}</b>
              <span className="muted"> · {data.done} faites · {data.deck.length} dans le Deck</span>
            </span>
            {data.queue.length > 0 ? (
              <Link className="btn primary" to="/physifox/revision">S’entraîner</Link>
            ) : data.pending > 0 ? (
              <Link className="btn" to="/physifox/revision?extra=10">Encore 10</Link>
            ) : null}
          </div>
          <div className="panel stack">
            <div className="panel-title">Par chapitre</div>
            {data.perChapter.map(({ c, n, learned }) => (
              <div key={c.id} className="spread">
                <Link to={`/physifox/${c.slug}`}>{c.title}</Link>
                <span className="small muted">{learned} / {n} bien retenues</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PfReview() {
  const { session } = useAuth();
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const flippedAt = useRef(0);
  const [tally, setTally] = useState({ easy: 0, hard: 0, forgot: 0 });

  useEffect(() => {
    (async () => {
      const extra = Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('extra') ?? 0);
      const s = await deckSession(session!.id, extra);
      setQueue(((await db.cards.bulkGet(s.queue)).filter(Boolean)) as Card[]);
    })();
  }, [session]);

  const flip = useCallback(() => {
    setFlipped((f) => {
      if (!f) flippedAt.current = Date.now();
      return true;
    });
  }, []);
  const answer = useCallback(
    async (r: Rating) => {
      if (!queue || !flipped || Date.now() - flippedAt.current < 500) return;
      await recordDeckAnswer(session!.id, queue[i].id, r);
      setTally((t) => ({ ...t, [r]: t[r] + 1 }));
      setFlipped(false);
      setI((n) => n + 1);
    },
    [queue, i, flipped, session],
  );
  async function report() {
    const text = await ask('Qu’est-ce qui est erroné ou confus dans cette flashcard ?');
    if (!text?.trim()) return;
    await sendPfMessage(session!.id, session!.id, text, queue![i].id);
    toast('Merci ! Votre message est envoyé au professeur.');
  }

  if (!queue) return null;
  const card = queue[i];
  if (!card)
    return (
      <div className="page narrow stack" style={{ textAlign: 'center', alignItems: 'center' }}>
        <img src="./logo.png" alt="" style={{ width: 140 }} />
        <h1 className="title">{i ? 'Bravo !' : 'Rien à revoir'}</h1>
        {i > 0 && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <span className="tag bad">{tally.forgot} à revoir</span>
            <span className="tag warn">{tally.hard} dur</span>
            <span className="tag ok">{tally.easy} facile</span>
          </div>
        )}
        <Link to="/physifox/deck" className="btn primary big">Retour</Link>
      </div>
    );
  return (
    <div className="page">
      <div className="review">
        <div className="review-top">
          <Link to="/physifox/deck" className="icon-btn" style={{ border: '1.5px solid var(--muted-line)', background: 'var(--paper)' }} title="Arrêter">
            <Icon name="x" />
          </Link>
          <div className="bar">
            <span>{i + 1} / {queue.length}</span>
            <div className="track"><div style={{ width: `${(i / queue.length) * 100}%` }} /></div>
          </div>
          <button className="btn small ghost" onClick={report} title="Signaler une flashcard erronée ou confuse">
            <Icon name="alert" size={16} /> Signaler
          </button>
        </div>
        <div className="flip" onClick={flip} style={{ cursor: flipped ? 'default' : 'pointer' }}>
          <CardFace html={flipped ? card.back : card.front} full />
        </div>
        <div className="review-actions">
          {!flipped ? (
            <button className="btn primary big reveal" style={{ width: '100%' }} onClick={flip}>Voir la réponse</button>
          ) : (
            <div className="answers">
              <button className="forgot" onClick={() => answer('forgot')}><Icon name="x" size={22} stroke={2.4} />Je ne sais pas</button>
              <button className="hard" onClick={() => answer('hard')}><Icon name="minus" size={22} stroke={2.4} />J'hésite…</button>
              <button className="easy" onClick={() => answer('easy')}><Icon name="check" size={22} stroke={2.6} />Facile</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Messages ----------

export function PfThread({ visitorId, authorId, side }: { visitorId: string; authorId: string; side: 'prof' | 'visiteur' }) {
  const [text, setText] = useState('');
  const messages = useLiveQuery(async () => {
    const ms = (await db.pfMessages.where('visitorId').equals(visitorId).toArray()).sort((a, b) => a.createdAt - b.createdAt);
    const cards = await db.cards.bulkGet(ms.map((m) => m.cardId ?? ''));
    return ms.map((m, i) => ({ m, card: cards[i] }));
  }, [visitorId], []);
  // Ouvrir la conversation marque les messages reçus comme lus
  useEffect(() => {
    const key = side === 'prof' ? 'readByProf' : 'readByVisitor';
    messages.filter(({ m }) => m.authorId !== authorId && !m[key]).forEach(({ m }) => db.pfMessages.update(m.id, { [key]: Date.now() }));
  }, [messages, authorId, side]);
  async function send(e: FormEvent) {
    e.preventDefault();
    await sendPfMessage(visitorId, authorId, text);
    setText('');
  }
  return (
    <div className="stack">
      {!messages.length && <p className="muted" style={{ margin: 0 }}>Aucun message pour l’instant.</p>}
      {messages.map(({ m, card }) => (
        <div key={m.id} className={'pf-msg' + (m.authorId === authorId ? ' mine' : '')}>
          {m.cardId && <div className="small muted">À propos de la flashcard {card?.code ?? ''}</div>}
          {card && <div className="pf-msg-card"><CardFace html={card.front} /></div>}
          <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
          <div className="small muted">{new Date(m.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>
        </div>
      ))}
      <form className="stack" onSubmit={send} style={{ gap: 8 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder="Votre message…" aria-label="Votre message" />
        <div><button className="btn primary" disabled={!text.trim()}>Envoyer</button></div>
      </form>
    </div>
  );
}

export function PfMessages() {
  const { session } = useAuth();
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>Messages</h1>
      <p className="muted" style={{ margin: 0 }}>Une question, une erreur repérée ? Votre message n’est lu que par le professeur.</p>
      <div className="panel"><PfThread visitorId={session!.id} authorId={session!.id} side="visiteur" /></div>
    </div>
  );
}
