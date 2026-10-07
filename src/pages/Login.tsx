import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../lib/auth';
import { db, DEMO_TEACHER } from '../lib/db';

export function Login() {
  const { session, login } = useAuth();
  const nav = useNavigate();
  const [l, setL] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const sample = useLiveQuery(() => db.students.limit(1).first());

  if (session) return <Navigate to={session.role === 'prof' ? '/prof' : '/eleve'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const s = await login(l, p);
    if (!s) setErr('Identifiant ou mot de passe incorrect.');
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
          Identifiant
          <input value={l} onChange={(e) => setL(e.target.value)} autoCapitalize="none" autoComplete="username" autoFocus />
        </label>
        <label className="field">
          Mot de passe
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
        </label>
        {err && <div style={{ color: 'var(--forgot)', fontWeight: 700 }}>{err}</div>}
        <button className="btn primary big" type="submit">
          Se connecter
        </button>
      </form>
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
    </div>
  );
}
