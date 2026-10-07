import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Création d'un compte professeur. Seules les adresses autorisées par l'administrateur obtiennent l'accès.
export function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) return setErr('Mot de passe : 8 caractères minimum.');
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pw,
      options: { data: { name: name.trim() }, emailRedirectTo: location.origin + location.pathname },
    });
    if (error) setErr(error.message);
    else setMsg('Compte créé. Ouvrez le lien de confirmation reçu par e-mail, puis connectez-vous.');
  }

  return (
    <div className="page narrow" style={{ paddingTop: 40 }}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <img src="./logo.png" alt="Logo FoxBox" style={{ width: 110 }} />
        <h1 className="title" style={{ marginBottom: 0 }}>Compte professeur</h1>
      </div>
      {msg ? (
        <div className="notice" style={{ marginTop: 20 }}>
          {msg} <Link to="/">Retour à la connexion</Link>
        </div>
      ) : (
        <form className="panel stack" onSubmit={submit} style={{ marginTop: 20 }}>
          <label className="field">
            Nom affiché (ex. E. Renard)
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            Adresse e-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="field">
            Mot de passe (8 caractères minimum)
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
          </label>
          {err && <div style={{ color: 'var(--forgot)', fontWeight: 700 }}>{err}</div>}
          <button className="btn primary big" type="submit">
            Créer mon compte
          </button>
          <span className="small muted">
            L'accès n'est ouvert qu'aux adresses autorisées par l'administrateur de FoxBox.
          </span>
        </form>
      )}
    </div>
  );
}
