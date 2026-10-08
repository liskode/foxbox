import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { runOcr, subscribeOcr, type OcrState } from './lib/ocr';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { subscribeSync, type SyncState } from './lib/sync';
import { ONLINE } from './lib/supabase';
import { Dashboard } from './pages/prof/Dashboard';
import { Cards } from './pages/prof/Cards';
import { Sequences } from './pages/prof/Sequences';
import { Groups, GroupPage } from './pages/prof/Groups';
import { Tickets } from './pages/prof/Tickets';
import { StudentPage } from './pages/prof/StudentPage';
import { ImportPage } from './pages/prof/Import';
import { Trombi } from './pages/prof/Trombi';
import { UpdateBanner } from './components/UpdateBanner';
import { TrombiPrint } from './pages/prof/TrombiPrint';
import { Correction } from './pages/prof/Correction';
import { EvaluationPage } from './pages/prof/Evaluation';
import { StudentHome } from './pages/eleve/Home';
import { ReviewSession } from './pages/eleve/Review';
import { MyStats } from './pages/eleve/MyStats';

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
      <span className="chip" style={{ background: '#f6c9c3' }} title={s.error}>
        ⚠ Hors ligne
      </span>
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
          ['/prof', 'Accueil'],
          ['/prof/cartes', 'Cartes'],
          ['/prof/sequences', 'Séquences'],
          ['/prof/classes', 'Classes'],
          ['/prof/correction', 'Correction'],
          ['/prof/trombi', 'Trombi'],
          ['/prof/import', 'Import'],
        ]
      : [
          ['/eleve', 'Réviser'],
          ['/eleve/stats', 'Mes progrès'],
        ];
  return (
    <>
      <header className="topbar noprint">
        <Link to={role === 'prof' ? '/prof' : '/eleve'} className="brand">
          <img src="./logo.png" alt="" />
          <span>FoxBox</span>
        </Link>
        <nav className="nav">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/prof' || to === '/eleve'}>
              {label}
            </NavLink>
          ))}
        </nav>
        <OcrBadge />
        {ONLINE && <SyncBadge />}
        <button className="btn small ghost" onClick={logout}>
          Déconnexion
        </button>
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
          <Route path="/prof/cartes" element={<Shell role="prof"><Cards /></Shell>} />
          <Route path="/prof/sequences" element={<Shell role="prof"><Sequences /></Shell>} />
          <Route path="/prof/classes" element={<Shell role="prof"><Groups /></Shell>} />
          <Route path="/prof/classes/:id" element={<Shell role="prof"><GroupPage /></Shell>} />
          <Route path="/prof/classes/:id/fiches" element={<Shell role="prof"><Tickets /></Shell>} />
          <Route path="/prof/eleves/:id" element={<Shell role="prof"><StudentPage /></Shell>} />
          <Route path="/prof/correction" element={<Shell role="prof"><Correction /></Shell>} />
          <Route path="/prof/correction/:id" element={<Shell role="prof"><EvaluationPage /></Shell>} />
          <Route path="/prof/trombi" element={<Shell role="prof"><Trombi /></Shell>} />
          <Route path="/prof/trombi/imprimer/:id" element={<Shell role="prof"><TrombiPrint /></Shell>} />
          <Route path="/prof/import" element={<Shell role="prof"><ImportPage /></Shell>} />
          <Route path="/eleve" element={<Shell role="eleve"><StudentHome /></Shell>} />
          <Route path="/eleve/revision/:subject" element={<Shell role="eleve"><ReviewSession /></Shell>} />
          <Route path="/eleve/stats" element={<Shell role="eleve"><MyStats /></Shell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
