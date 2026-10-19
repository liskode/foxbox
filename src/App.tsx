import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isClass, isTutoring, shortName } from './lib/db';
import { AuthProvider, useAuth, homeOf } from './lib/auth';
import { runOcr, subscribeOcr, type OcrState } from './lib/ocr';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { subscribeSync, retryFailed, type SyncState } from './lib/sync';
import { ONLINE } from './lib/supabase';
import { unreadTotal } from './lib/messages';
import { trackVisits } from './lib/visits';
import { UpdateBanner } from './components/UpdateBanner';
import { DialogHost } from './components/Dialog';
import { ToastHost } from './components/Toast';
import { Icon } from './components/Icon';

// Pages chargées à la demande : un élève ne télécharge pas la partie professeur (ni les outils d'import)
const Timetable = lazy(() => import('./pages/prof/Timetable').then((m) => ({ default: m.Timetable })));
const Competences = lazy(() => import('./pages/prof/Competences').then((m) => ({ default: m.Competences })));
const Settings = lazy(() => import('./pages/prof/Settings').then((m) => ({ default: m.Settings })));
const PlanScreen = lazy(() => import('./pages/prof/PlanScreen').then((m) => ({ default: m.PlanScreen })));
const About = lazy(() => import('./pages/prof/About').then((m) => ({ default: m.About })));
const Rooms = lazy(() => import('./pages/prof/Rooms').then((m) => ({ default: m.Rooms })));
const Family = lazy(() => import('./pages/prof/Family').then((m) => ({ default: m.Family })));
const Flashcards = lazy(() => import('./pages/prof/Flashcards').then((m) => ({ default: m.Flashcards })));
const Students = lazy(() => import('./pages/prof/Students').then((m) => ({ default: m.Students })));
const Dashboard = lazy(() => import('./pages/prof/Dashboard').then((m) => ({ default: m.Dashboard })));
const Sequences = lazy(() => import('./pages/prof/Sequences').then((m) => ({ default: m.Sequences })));
const GroupPage = lazy(() => import('./pages/prof/Groups').then((m) => ({ default: m.GroupPage })));
const Tickets = lazy(() => import('./pages/prof/Tickets').then((m) => ({ default: m.Tickets })));
const StudentPage = lazy(() => import('./pages/prof/StudentPage').then((m) => ({ default: m.StudentPage })));
const Trombi = lazy(() => import('./pages/prof/Trombi').then((m) => ({ default: m.Trombi })));
const TrombiPrint = lazy(() => import('./pages/prof/TrombiPrint').then((m) => ({ default: m.TrombiPrint })));
const Correction = lazy(() => import('./pages/prof/Correction').then((m) => ({ default: m.Correction })));
const EvaluationPage = lazy(() => import('./pages/prof/Evaluation').then((m) => ({ default: m.EvaluationPage })));
const StudentHome = lazy(() => import('./pages/eleve/Home').then((m) => ({ default: m.StudentHome })));
const ReviewSession = lazy(() => import('./pages/eleve/Review').then((m) => ({ default: m.ReviewSession })));
const MyStats = lazy(() => import('./pages/eleve/MyStats').then((m) => ({ default: m.MyStats })));
const StudentDocuments = lazy(() => import('./pages/eleve/Documents').then((m) => ({ default: m.StudentDocuments })));
const StudentMessages = lazy(() => import('./pages/eleve/Messages').then((m) => ({ default: m.StudentMessages })));
const ParentHome = lazy(() => import('./pages/parent/Home').then((m) => ({ default: m.ParentHome })));
const ParentMessages = lazy(() => import('./pages/parent/Home').then((m) => ({ default: m.ParentMessages })));
const RelevePage = lazy(() => import('./pages/prof/SoutienPrint').then((m) => ({ default: m.RelevePage })));
const AttestationPage = lazy(() => import('./pages/prof/SoutienPrint').then((m) => ({ default: m.AttestationPage })));
const StudentSoutien = lazy(() => import('./pages/eleve/Soutien').then((m) => ({ default: m.StudentSoutien })));
const Soutien = lazy(() => import('./pages/prof/Soutien').then((m) => ({ default: m.Soutien })));
const SoutienGroup = lazy(() => import('./pages/prof/SoutienGroup').then((m) => ({ default: m.SoutienGroup })));
const SoutienSession = lazy(() => import('./pages/prof/SoutienSession').then((m) => ({ default: m.SoutienSession })));

function OcrBadge() {
  const [s, setS] = useState<OcrState | null>(null);
  useEffect(() => {
    const off = subscribeOcr(setS);
    return () => {
      off();
    };
  }, []);
  if (!s?.running) return null;
  return (
    <span className="chip t-Outils" title="Lecture du texte des images pour la recherche">
      Lecture des images {s.done}/{s.total}
    </span>
  );
}

function SyncBadge() {
  const [s, setS] = useState<SyncState | null>(null);
  useEffect(() => {
    const off = subscribeSync(setS);
    return () => {
      off();
    };
  }, []);
  if (!s) return null;
  if (s.error)
    return (
      <button
        className="tag bad"
        style={{ border: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 800, fontSize: '0.8rem' }}
        title={s.error}
        onClick={() => {
          if (confirm(`Problème d'enregistrement en ligne :\n\n${s.error}\n\nRéessayer maintenant ?`)) retryFailed();
        }}
      >
        <Icon name="alert" size={14} /> {s.failed ? `${s.failed} non enregistré(s)` : 'Hors ligne'}
      </button>
    );
  if (s.syncing || s.pending)
    return (
      <span className="tag plain" title="Enregistrement en ligne">
        <Icon name="sync" size={14} /> {s.pending || ''}
      </span>
    );
  return (
    <span className="tag" style={{ color: 'var(--ok)', padding: 0 }} title="Tout est enregistré en ligne">
      <Icon name="check" size={14} stroke={2.5} /> <span className="sync-label">Enregistré</span>
    </span>
  );
}

// Page sans bandeau (ex. plan de classe projeté au tableau), réservée au rôle indiqué
function Bare({ role, children }: { role: 'prof' | 'eleve'; children: ReactNode }) {
  const { session, ready } = useAuth();
  if (!ready) return null;
  if (!session || session.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Accès permanent aux classes depuis le bandeau (pastille entourée = classe ouverte)
function TopClassChips() {
  const groups = useLiveQuery(
    async () => (await db.groups.filter((g) => !g.archived && isClass(g)).toArray()).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })),
    [],
    [],
  );
  const { pathname } = useLocation();
  if (!groups.length) return null;
  return (
    <>
      <span className="nav-sep" />
      {groups.map((g) => {
        const active = pathname.startsWith(`/prof/classes/${g.id}`);
        return (
          <Link
            key={g.id}
            to={`/prof/classes/${g.id}?onglet=apercu`}
            className={'chip cchip nav-class' + (active ? ' on' : '')}
            title={g.name}
            style={{ background: g.color ?? 'var(--paper)' }}
          >
            {shortName(g.name)}
          </Link>
        );
      })}
    </>
  );
}

// Menu du professeur sur téléphone : un bouton « Menu » ouvre la liste des pages et des classes
function MobileMenu({ links, logout }: { links: string[][]; logout: () => void }) {
  const [open, setOpen] = useState(false);
  const { pathname, search } = useLocation();
  useEffect(() => setOpen(false), [pathname, search]);
  const groups = useLiveQuery(
    async () => (await db.groups.filter((g) => !g.archived && isClass(g)).toArray()).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })),
    [],
    [],
  );
  const current =
    links.find(([to]) => to !== '/prof' && pathname.startsWith(to))?.[1] ??
    groups.find((g) => pathname.startsWith(`/prof/classes/${g.id}`))?.name.split('_')[0] ??
    (pathname === '/prof' ? 'Tableau de bord' : pathname.startsWith('/prof/reglages') ? 'Réglages' : '');
  return (
    <>
      <button className="menu-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name={open ? 'x' : 'menu'} size={20} />
        <span>{current || 'Menu'}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <>
          <div className="menu-bg" onClick={() => setOpen(false)} />
          <div className="menu-panel">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/prof'} className="menu-link">
                {label}
              </NavLink>
            ))}
            {groups.length > 0 && (
              <>
                <div className="menu-sub">Classes</div>
                <div className="menu-classes">
                  {groups.map((g) => (
                    <Link
                      key={g.id}
                      to={`/prof/classes/${g.id}?onglet=apercu`}
                      className={'chip cchip' + (pathname.startsWith(`/prof/classes/${g.id}`) ? ' on' : '')}
                      style={{ background: g.color ?? 'var(--paper)' }}
                    >
                      {shortName(g.name)}
                    </Link>
                  ))}
                </div>
              </>
            )}
            <div className="menu-sub" />
            <NavLink to="/prof/reglages" className="menu-link">
              <Icon name="settings" /> Réglages
            </NavLink>
            <NavLink to="/prof/about" className="menu-link">
              À propos
            </NavLink>
            <button className="menu-link" onClick={logout}>
              <Icon name="logout" /> Déconnexion
            </button>
          </div>
        </>
      )}
    </>
  );
}

function Shell({ role, children }: { role: 'prof' | 'eleve' | 'parent'; children: ReactNode }) {
  const { session, ready, logout } = useAuth();
  const { pathname } = useLocation();
  // Module Soutien : activé dans les Réglages (professeur) ; onglet affiché à l'élève suivi en soutien
  const soutien = useLiveQuery(
    async () => {
      if (!session) return false;
      if (session.role === 'prof') return !!(await db.teachers.get(session.id))?.modules?.soutien;
      const ms = await db.memberships.where('studentId').equals(session.id).toArray();
      return (await db.groups.bulkGet(ms.map((m) => m.groupId))).some((g) => isTutoring(g) && !g!.archived);
    },
    [session?.id, session?.role],
    false,
  );
  // Messages non lus : pastille sur « Soutien » (professeur, élève) ou « Messages » (parents)
  const unread = useLiveQuery(async () => (session ? unreadTotal(session.id, session.role) : 0), [session?.id, session?.role], 0);
  const badgeOn = role === 'parent' ? '/parent/messages' : role === 'prof' ? '/prof/soutien' : '/eleve/soutien';
  // Journal des connexions (élèves et parents)
  useEffect(() => {
    if (session && session.role !== 'prof') trackVisits(session);
  }, [session]);
  useEffect(() => {
    // Reprend la lecture des images interrompue (fermeture de l'onglet…)
    if (session?.role === 'prof') runOcr();
  }, [session]);
  if (!ready) return null;
  if (!session) return <Navigate to="/" replace />;
  if (session.role !== role) return <Navigate to={homeOf(session.role)} replace />;
  const links =
    role === 'prof'
      ? [
          ['/prof', 'Tableau de bord'],
          ['/prof/progression', 'Progression'],
          ['/prof/correction', 'Évaluations'],
          ['/prof/flashcards', 'Flashcards'],
          ['/prof/eleves', 'Élèves'],
          ...(soutien ? [['/prof/soutien', 'Soutien']] : []),
        ]
      : role === 'parent'
        ? [
            ['/parent', 'Suivi'],
            ['/parent/messages', 'Messages'],
          ]
        : [
            ['/eleve', 'Flashcards'],
            ...(soutien ? [['/eleve/soutien', 'Soutien']] : []),
            ['/eleve/notes', 'Évaluations'],
            ['/eleve/documents', 'Documents de cours'],
          ];
  const icons: Record<string, string> = {
    '/eleve': 'cards',
    '/eleve/soutien': 'clipboard',
    '/eleve/notes': 'bars',
    '/eleve/documents': 'file',
    '/parent': 'clipboard',
    '/parent/messages': 'message',
  };
  const home = role === 'parent' ? '/parent' : '/eleve';
  const badge = (to: string) => (to === badgeOn && unread > 0 ? <span className="badge">{unread}</span> : null);
  return (
    <div className={role !== 'prof' ? 'eleve-shell' + (pathname.startsWith('/eleve/revision') ? ' reviewing' : '') : undefined}>
      <header className={'topbar noprint' + (role === 'prof' ? ' thin' : '')}>
        <Link to={role === 'prof' ? '/prof/about' : home} className="brand" title={role === 'prof' ? 'À propos de FoxBox' : 'Accueil'}>
          <img src="./logo.png" alt="FoxBox" />
          {role !== 'prof' && <span>FoxBox</span>}
        </Link>
        <nav className="nav">
          {links.map(([to, label], i) =>
            to === '|' ? (
              <span key={i} className="nav-sep" />
            ) : to === '#' ? (
              <span key={i} className="small muted" style={{ alignSelf: 'center', fontWeight: 700 }}>
                {label}
              </span>
            ) : (
              <NavLink key={to} to={to} end={to === '/prof' || to === '/eleve' || to === '/parent'}>
                {label} {badge(to)}
              </NavLink>
            ),
          )}
          {role === 'prof' && <TopClassChips />}
        </nav>
        {role === 'prof' && <MobileMenu links={links} logout={logout} />}
        <OcrBadge />
        {ONLINE && <SyncBadge />}
        {role === 'prof' ? (
          <>
            <NavLink to="/prof/reglages" className="icon-btn desk" title="Réglages : emploi du temps, classes, couleurs, compétences">
              <Icon name="settings" />
            </NavLink>
            <button className="icon-btn desk" onClick={logout} title="Déconnexion">
              <Icon name="logout" />
            </button>
          </>
        ) : (
          <button className="btn small ghost" onClick={logout}>
            Déconnexion
          </button>
        )}
      </header>
      {children}
      {role !== 'prof' && (
        <nav className="bottom-nav noprint">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === home}>
              <span style={{ position: 'relative' }}>
                <Icon name={icons[to]} size={22} />
                {to === badgeOn && unread > 0 && <span className="badge" style={{ position: 'absolute', top: -6, right: -12 }}>{unread}</span>}
              </span>
              {label.replace(' de cours', '')}
            </NavLink>
          ))}
          <button onClick={logout}>
            <Icon name="logout" size={22} />
            Quitter
          </button>
        </nav>
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <DialogHost />
      <ToastHost />
      <HashRouter>
        <UpdateBanner />
        <Suspense fallback={<div className="page muted">Chargement…</div>}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/inscription" element={<Signup />} />
          <Route path="/prof" element={<Shell role="prof"><Dashboard /></Shell>} />
          <Route path="/prof/flashcards" element={<Shell role="prof"><Flashcards /></Shell>} />
          <Route path="/prof/cartes" element={<Navigate to="/prof/flashcards" replace />} />
          <Route path="/prof/reglages" element={<Shell role="prof"><Settings /></Shell>} />
          <Route path="/prof/eleves" element={<Shell role="prof"><Students /></Shell>} />
          <Route path="/prof/progression" element={<Shell role="prof"><Sequences /></Shell>} />
          <Route path="/prof/progression/:seqId" element={<Shell role="prof"><Sequences /></Shell>} />
          <Route path="/prof/sequences" element={<Navigate to="/prof/progression" replace />} />
          <Route path="/prof/classes" element={<Navigate to="/prof/reglages" replace />} />
          <Route path="/prof/classes/:id" element={<Shell role="prof"><GroupPage /></Shell>} />
          <Route path="/prof/classes/:id/fiches" element={<Shell role="prof"><Tickets /></Shell>} />
          <Route path="/prof/eleves/:id/famille" element={<Shell role="prof"><Family /></Shell>} />
          <Route path="/prof/eleves/:id" element={<Shell role="prof"><StudentPage /></Shell>} />
          <Route path="/prof/correction" element={<Shell role="prof"><Correction /></Shell>} />
          <Route path="/prof/correction/:id" element={<Shell role="prof"><EvaluationPage /></Shell>} />
          <Route path="/prof/trombi" element={<Shell role="prof"><Trombi /></Shell>} />
          <Route path="/prof/trombi/imprimer/:id" element={<Shell role="prof"><TrombiPrint /></Shell>} />
          <Route path="/prof/competences" element={<Shell role="prof"><Competences /></Shell>} />
          <Route path="/prof/plan/:groupId/:planId" element={<Bare role="prof"><PlanScreen /></Bare>} />
          <Route path="/prof/about" element={<Shell role="prof"><About /></Shell>} />
          <Route path="/prof/salles" element={<Shell role="prof"><Rooms /></Shell>} />
          <Route path="/prof/edt" element={<Shell role="prof"><Timetable /></Shell>} />
          <Route path="/prof/import" element={<Navigate to="/prof/flashcards?onglet=import" replace />} />
          <Route path="/prof/soutien" element={<Shell role="prof"><Soutien /></Shell>} />
          <Route path="/prof/soutien/releve/:studentId" element={<Shell role="prof"><RelevePage /></Shell>} />
          <Route path="/prof/soutien/attestation/:studentId" element={<Shell role="prof"><AttestationPage /></Shell>} />
          <Route path="/prof/soutien/:id" element={<Shell role="prof"><SoutienGroup /></Shell>} />
          <Route path="/prof/soutien/:id/seance/:sid" element={<Shell role="prof"><SoutienSession /></Shell>} />
          <Route path="/eleve" element={<Shell role="eleve"><StudentHome /></Shell>} />
          <Route path="/eleve/revision/:subject" element={<Shell role="eleve"><ReviewSession /></Shell>} />
          <Route path="/eleve/notes" element={<Shell role="eleve"><MyStats /></Shell>} />
          <Route path="/eleve/stats" element={<Navigate to="/eleve" replace />} />
          <Route path="/eleve/documents" element={<Shell role="eleve"><StudentDocuments /></Shell>} />
          <Route path="/eleve/soutien" element={<Shell role="eleve"><StudentSoutien /></Shell>} />
          <Route path="/eleve/messages" element={<Shell role="eleve"><StudentMessages /></Shell>} />
          <Route path="/parent" element={<Shell role="parent"><ParentHome /></Shell>} />
          <Route path="/parent/messages" element={<Shell role="parent"><ParentMessages /></Shell>} />
          <Route path="/parent/releve/:studentId" element={<Shell role="parent"><RelevePage /></Shell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}
