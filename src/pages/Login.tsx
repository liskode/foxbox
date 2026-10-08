import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../lib/auth';
import { db, DEMO_TEACHER } from '../lib/db';
import { ONLINE } from '../lib/supabase';

export function Login() {
  const { session, ready, login } = useAuth();
  const nav = useNavigate();
  const [l, setL] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const sample = useLiveQuery(() => (ONLINE ? undefined : db.students.limit(1).first()));

  if (!ready) return null;
  if (session) return <Navigate to={session.role === 'prof' ? '/prof' : '/eleve'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const s = await login(l, p);
    setBusy(false);
    if ('error' in s) setErr(s.error);
    else nav(s.role === 'prof' ? '/prof' : '/eleve');
  }

  return (
    <div className="page narrow" style={{ paddingTop: 50 }}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <img src="./logo.png" alt="Logo FoxBox" style={{ width: 150 }} />
        <h1 className="title" style={{ fontSize: '3.4rem', marginBottom: 0 }}>FoxBox</h1>
        <p className="muted" style={{ marginTop: 0 }}>Mes cartes de révision, une boîte à la fois.</p>
      </div>
      <form className="panel stack" onSubmit={submit} style={{ marginTop: 20 }}>
        <label className="field">
          Identifiant <span className="muted small" style={{ fontWeight: 600 }}>(élève : prenom.nom — professeur : adresse e-mail)</span>
          <input value={l} onChange={(e) => setL(e.target.value)} autoCapitalize="none" autoComplete="username" autoFocus />
        </label>
        <label className="field">
          Mot de passe
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
        </label>
        {err && <div style={{ color: 'var(--forgot)', fontWeight: 700 }}>{err}</div>}
        <button className="btn primary big" type="submit" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      {ONLINE ? (
        <p className="small muted" style={{ textAlign: 'center', marginTop: 16 }}>
          Élève : utilise l'identifiant et le mot de passe donnés par ton professeur.
          <br />
          Professeur : <Link to="/inscription">créer mon compte</Link>
        </p>
      ) : (
      <div className="notice small" style={{ marginTop: 20 }}>
        <b>Version de démonstration</b> — les données restent dans ce navigateur.
        <br />
        Professeur : <span className="code">{DEMO_TEACHER.login}</span> / <span className="code">{DEMO_TEACHER.password}</span>
        {sample && (
          <>
            <br />
            Élève (exemple) : <span className="code">{sample.login}</span> / <span className="code">{sample.password}</span>
          </>
        )}
      </div>
      )}
    </div>
  );
}
