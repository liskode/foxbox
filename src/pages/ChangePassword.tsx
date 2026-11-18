// Première connexion d'un co-enseignant dont le compte a été créé par un collègue :
// il remplace le mot de passe provisoire par le sien avant d'utiliser FoxBox.
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { toast } from '../components/Toast';

export function ChangePassword({ teacherId, name, onLogout }: { teacherId: string; name: string; onLogout: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) return setErr('Mot de passe : 8 caractères minimum.');
    if (pw !== pw2) return setErr('Les deux mots de passe sont différents.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    await db.teachers.update(teacherId, { mustChangePassword: false });
    toast('Mot de passe enregistré');
  }

  return (
    <div className="page narrow" style={{ paddingTop: 40 }}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <img src="./logo.png" alt="Logo FoxBox" style={{ width: 110 }} />
        <h1 className="title" style={{ marginBottom: 0 }}>Bienvenue</h1>
      </div>
      <form className="panel stack" onSubmit={submit} style={{ marginTop: 20 }}>
        <span>
          Bonjour {name}, votre compte a été créé avec un mot de passe provisoire. Choisissez votre propre mot de passe pour continuer.
        </span>
        <label className="field">
          Nouveau mot de passe (8 caractères minimum)
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
        </label>
        <label className="field">
          Le même, une seconde fois
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
        </label>
        {err && <div style={{ color: 'var(--forgot)', fontWeight: 700 }}>{err}</div>}
        <button className="btn primary big" type="submit" disabled={busy}>
          Enregistrer mon mot de passe
        </button>
        <button className="btn ghost" type="button" onClick={onLogout}>
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
