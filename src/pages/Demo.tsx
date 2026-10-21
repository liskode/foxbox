// Page publique « Démo » : courte présentation, puis un profil à essayer par colonne (professeur, élève en classe,
// élève en soutien, parent), avec ses fonctionnalités. Les profils sont choisis par le professeur dans ses Réglages.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isDemo } from '../lib/demoMode';
import { supabase, ONLINE } from '../lib/supabase';
import { homeOf, useAuth } from '../lib/auth';
import { DEMO_COLUMNS } from './prof/About';
import { Icon } from '../components/Icon';
import type { DemoProfile } from '../lib/demoMode';

interface Info {
  enabled: boolean;
  intro: string;
  profiles: Record<DemoProfile, boolean>;
}

export function Demo() {
  const { session, demoLogin } = useAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState<DemoProfile | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!ONLINE) return setInfo({ enabled: false, intro: '', profiles: { prof: false, eleve: false, soutien: false, parent: false } });
    supabase.functions
      .invoke('demo', { body: { action: 'info' } })
      .then(({ data }) => setInfo(data ?? { enabled: false, intro: '', profiles: {} }))
      .catch(() => setInfo({ enabled: false, intro: '', profiles: { prof: false, eleve: false, soutien: false, parent: false } }));
  }, []);
  const nav = useNavigate();

  async function open(p: DemoProfile) {
    setBusy(p);
    setErr('');
    const r = await demoLogin(p);
    setBusy(null);
    if ('error' in r) setErr(r.error);
    else nav(homeOf(r.role));
  }

  const cols = DEMO_COLUMNS.filter((c) => info?.profiles[c.key]);
  return (
    <div className="page stack" style={{ maxWidth: 1200 }}>
      <div className="row" style={{ gap: 16, flexWrap: 'nowrap' }}>
        <img src="./logo.png" alt="" style={{ width: 80 }} />
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            FoxBox
          </h1>
          <div className="muted">
            Révisions, progression, évaluations et suivi des élèves, en classe et en cours particuliers — conçu par et pour un professeur.
          </div>
        </div>
      </div>
      <div className="panel note stack" style={{ gap: 6 }}>
        <b>Démo en lecture seule</b>
        <span>
          Choisissez un profil pour découvrir FoxBox de l’intérieur. Vous pouvez cliquer partout et essayer : <b>rien n’est enregistré</b>. Le contenu de
          cette démo est celui de cours de physique-chimie, mais FoxBox convient à toutes les matières.
        </span>
        {info?.intro && <span style={{ whiteSpace: 'pre-wrap' }}>{info.intro}</span>}
      </div>
      {!info && <div className="muted">Chargement…</div>}
      {info && !info.enabled && (
        <div className="notice">
          La démo est fermée pour le moment. <Link to="/">Se connecter</Link>
        </div>
      )}
      {err && <div className="notice">{err}</div>}
      {session && !isDemo() && info?.enabled && (
        <div className="notice small">Vous êtes connecté(e) à votre compte : essayer un profil vous en déconnecte (reconnectez-vous ensuite normalement).</div>
      )}
      {cols.length > 0 && (
        <div className="demo-cols">
          {cols.map((c) => (
            <div key={c.key} className="panel stack" style={{ gap: 10 }}>
              <div className="demo-icon">
                <Icon name={c.icon} size={34} stroke={1.8} />
              </div>
              <div>
                <h2 style={{ margin: 0 }}>{c.title}</h2>
                <span className="small muted">{c.sub}</span>
              </div>
              <button className="btn primary" style={{ justifyContent: 'center' }} disabled={!!busy} onClick={() => open(c.key)}>
                {busy === c.key ? 'Ouverture…' : 'Essayer'}
              </button>
              <ul className="demo-features">
                {c.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="small muted" style={{ textAlign: 'center' }}>
        Vous avez un compte ? <Link to="/">Se connecter</Link>
      </p>
    </div>
  );
}
