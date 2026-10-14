// Message de confirmation discret en bas de l'écran (« Séance cochée… »), avec un lien Annuler facultatif.
import { useEffect, useState } from 'react';
import { Icon } from './Icon';

interface Msg {
  id: number;
  text: string;
  undo?: () => void;
  error?: boolean;
}
let push: ((m: Msg) => void) | null = null;
let n = 0;

export function toast(text: string, opts: { undo?: () => void; error?: boolean } = {}) {
  push?.({ id: ++n, text, ...opts });
}

export function ToastHost() {
  const [msg, setMsg] = useState<Msg | null>(null);
  useEffect(() => {
    push = setMsg;
    return () => {
      push = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.undo ? 10000 : 4000);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div className="toast-msg noprint" role="status">
      <Icon name={msg.error ? 'alert' : 'check'} size={16} stroke={2.5} />
      <span>{msg.text}</span>
      {msg.undo && (
        <button
          onClick={() => {
            msg.undo!();
            setMsg(null);
          }}
        >
          Annuler
        </button>
      )}
    </div>
  );
}
