import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, shortName } from './lib/db';
import { AuthProvider, useAuth } from './lib/auth';
import { runOcr, subscribeOcr, type OcrState } from './lib/ocr';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { subscribeSync, retryFailed, type SyncState } from './lib/sync';
import { ONLINE } from './lib/supabase';
import { UpdateBanner } from './components/UpdateBanner';
import { DialogHost } from './components/Dialog';

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
        className="chip"
        style={{ background: '#f6c9c3', cursor: 'pointer' }}
        title={s.error}
        onClick={() => {
          if (confirm(`Problème d'enregistrement en ligne :\n\n${s.error}\n\nRéessayer maintenant ?`)) retryFailed();
        }}
      >
        ⚠ {s.failed ? `${s.failed} non enregistré(s)` : 'Hors ligne'}
      </button>
    );
  if (s.syncing || s.pending)
    return <span className="chip" title="Enregistrement en ligne">⟳ {s.pending || ''}</span>;
  return (
    <span className="chip" style={{ background: 'var(--paper)' }} title="Tout est enregistré en ligne">
      ✓
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
    async () => (await db.groups.filter((g) => !g.archived).toArray()).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })),
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
            className="chip cchip nav-class"
            title={g.name}
            style={{ background: g.color ?? 'var(--paper)', outline: active ? '3px solid var(--ink)' : undefined }}
          >
            {shortName(g.name)}
          </Link>
        );
      })}
    </>
  );
}

function Shell({ role, children }: { role: 'prof' | 'eleve'; children: ReactNode }) {
  const { session, ready, logout } = useAuth();
  useEffect(() => {
    // Reprend la lecture des images interrompue (fermeture de l'onglet…)
    if (session?.role === 'prof') runOcr();
  }, [session]);
  if (!ready) return null;
  if (!session) return <Navigate to="/" replace />;
  if (session.role !== role) return <Navigate to={session.role === 'prof' ? '/prof' : '/eleve'} replace />;
  const links =
    role === 'prof'
      ? [
          ['/prof', 'Tableau de bord'],
          ['/prof/progression', 'Progression'],
          ['/prof/correction', 'Évaluations'],
          ['/prof/flashcards', 'Flashcards'],
          ['/prof/eleves', 'Élèves'],
        ]
      : [
          ['/eleve', 'Flashcards'],
          ['/eleve/notes', 'Notes'],
          ['/eleve/documents', 'Documents de cours'],
        ];
  return (
    <>
      <header className={'topbar noprint' + (role === 'prof' ? ' thin' : '')}>
        <Link to={role === 'prof' ? '/prof/about' : '/eleve'} className="brand" title={role === 'prof' ? 'À propos de FoxBox' : 'Accueil'}>
          <img src="./logo.png" alt="FoxBox" />
          {role === 'eleve' && <span>FoxBox</span>}
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
              <NavLink key={to} to={to} end={to === '/prof' || to === '/eleve'}>
                {label}
              </NavLink>
            ),
          )}
          {role === 'prof' && <TopClassChips />}
        </nav>
        <OcrBadge />
        {ONLINE && <SyncBadge />}
        {role === 'prof' ? (
          <>
            <NavLink to="/prof/reglages" className="icon-btn" title="Réglages : emploi du temps, classes, couleurs, compétences">
              ⚙️
            </NavLink>
            <button className="icon-btn" onClick={logout} title="Déconnexion">
              ⏻
            </button>
          </>
        ) : (
          <button className="btn small ghost" onClick={logout}>
            Déconnexion
          </button>
        )}
      </header>
      {children}
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <DialogHost />
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
          <Route path="/eleve" element={<Shell role="eleve"><StudentHome /></Shell>} />
          <Route path="/eleve/revision/:subject" element={<Shell role="eleve"><ReviewSession /></Shell>} />
          <Route path="/eleve/notes" element={<Shell role="eleve"><MyStats /></Shell>} />
          <Route path="/eleve/stats" element={<Navigate to="/eleve" replace />} />
          <Route path="/eleve/documents" element={<Shell role="eleve"><StudentDocuments /></Shell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}
