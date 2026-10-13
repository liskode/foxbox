// Boîte de dialogue intégrée (remplace les fenêtres prompt() du navigateur) :
// champs de saisie et choix sur boutons, Entrée pour valider, Échap pour annuler.
import { useEffect, useRef, useState } from 'react';

export interface Field {
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
  options?: { value: string; label: string }[]; // choix sur boutons
  optional?: boolean;
}
interface Request {
  title: string;
  message?: string;
  fields: Field[];
  ok?: string;
  resolve: (v: Record<string, string> | null) => void;
}

let open: ((r: Request) => void) | null = null;

export function askForm(title: string, fields: Field[], ok = 'Valider'): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    if (!open) return resolve(null);
    open({ title, fields, ok, resolve });
  });
}

// Simple message (ex. nouveau mot de passe), avec un bouton OK
export async function showInfo(title: string, message: string) {
  await new Promise<void>((resolve) => {
    if (!open) return resolve();
    open({ title, message, fields: [], ok: 'OK', resolve: () => resolve() });
  });
}

// Une seule valeur (texte, ou choix si options) ; null si annulé
export async function ask(title: string, field: Omit<Field, 'key' | 'label'> & { label?: string } = {}): Promise<string | null> {
  const r = await askForm(title, [{ key: 'v', label: field.label ?? '', ...field }]);
  return r ? r.v : null;
}

export function DialogHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    open = (r) => {
      setValues(Object.fromEntries(r.fields.map((f) => [f.key, f.value ?? f.options?.[0]?.value ?? ''])));
      setReq(r);
    };
    return () => {
      open = null;
    };
  }, []);
  useEffect(() => {
    if (req) setTimeout(() => first.current?.focus(), 30);
  }, [req]);
  if (!req) return null;

  const done = (v: Record<string, string> | null) => {
    req.resolve(v);
    setReq(null);
  };
  const valid = req.fields.every((f) => f.optional || f.options || values[f.key]?.trim());
  const submit = () => valid && done(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])));
  let firstText = true;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(29,29,27,0.35)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }} onClick={() => done(null)}>
      <div
        className="panel stack"
        style={{ width: 'min(520px, 92vw)', gap: 12 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') done(null);
          else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') submit();
        }}
      >
        <b style={{ fontSize: '1.05rem' }}>{req.title}</b>
        {req.message && <div style={{ whiteSpace: 'pre-wrap', fontSize: '1.05rem' }}>{req.message}</div>}
        {req.fields.map((f) => {
          const isFirst = !f.options && firstText;
          if (!f.options) firstText = false;
          return (
            <label key={f.key} className="field">
              {f.label}
              {f.options ? (
                <div className="row" style={{ gap: 6 }}>
                  {f.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={'btn small' + (values[f.key] === o.value ? ' primary' : ' ghost')}
                      style={{ whiteSpace: 'normal', textAlign: 'left' }}
                      onClick={() => setValues({ ...values, [f.key]: o.value })}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  ref={isFirst ? first : undefined}
                  value={values[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              )}
            </label>
          );
        })}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {req.fields.length > 0 && (
            <button className="btn ghost" onClick={() => done(null)}>
              Annuler
            </button>
          )}
          <button className="btn primary" disabled={!valid} onClick={submit}>
            {req.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
