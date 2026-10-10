import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { runOcr, subscribeOcr, type OcrState } from './lib/ocr';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { subscribeSync, retryFailed, type SyncState } from './lib/sync';
import { ONLINE } from './lib/supabase';
import { Timetable } from './pages/prof/Timetable';
import { Competences } from './pages/prof/Competences';
import { Settings } from './pages/prof/Settings';
import { Flashcards } from './pages/prof/Flashcards';
import { Students } from './pages/prof/Students';
import { Dashboard } from './pages/prof/Dashboard';
import { Sequences } from './pages/prof/Sequences';
import { GroupPage } from './pages/prof/Groups';
import { Tickets } from './pages/prof/Tickets';
import { StudentPage } from './pages/prof/StudentPage';
import { Trombi } from './pages/prof/Trombi';
import { UpdateBanner } from './components/UpdateBanner';
import { TrombiPrint } from './pages/prof/TrombiPrint';
import { Correction } from './pages/prof/Correction';
import { EvaluationPage } from './pages/prof/Evaluation';
import { StudentHome } from './pages/eleve/Home';
import { ReviewSession } from './pages/eleve/Review';
import { MyStats } from './pages/eleve/MyStats';
import { StudentDocuments } from './pages/eleve/Documents';

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
        <Link to={role === 'prof' ? '/prof' : '/eleve'} className="brand" title="Accueil">
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
      <HashRouter>
        <UpdateBanner />
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
          <Route path="/prof/eleves/:id" element={<Shell role="prof"><StudentPage /></Shell>} />
          <Route path="/prof/correction" element={<Shell role="prof"><Correction /></Shell>} />
          <Route path="/prof/correction/:id" element={<Shell role="prof"><EvaluationPage /></Shell>} />
          <Route path="/prof/trombi" element={<Shell role="prof"><Trombi /></Shell>} />
          <Route path="/prof/trombi/imprimer/:id" element={<Shell role="prof"><TrombiPrint /></Shell>} />
          <Route path="/prof/competences" element={<Shell role="prof"><Competences /></Shell>} />
          <Route path="/prof/edt" element={<Shell role="prof"><Timetable /></Shell>} />
          <Route path="/prof/import" element={<Navigate to="/prof/flashcards?onglet=import" replace />} />
          <Route path="/eleve" element={<Shell role="eleve"><StudentHome /></Shell>} />
          <Route path="/eleve/revision/:subject" element={<Shell role="eleve"><ReviewSession /></Shell>} />
          <Route path="/eleve/notes" element={<Shell role="eleve"><MyStats /></Shell>} />
          <Route path="/eleve/stats" element={<Navigate to="/eleve" replace />} />
          <Route path="/eleve/documents" element={<Shell role="eleve"><StudentDocuments /></Shell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
