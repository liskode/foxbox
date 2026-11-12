import { useEffect, useState } from 'react';
import { ONLINE, supabase } from './supabase';

// Site public Physifox ouvert ou fermé (fermé : seul l'administrateur voit les contenus, le serveur le vérifie aussi)
let listeners: ((open: boolean) => void)[] = [];

export function usePfSiteOpen(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(ONLINE ? null : true);
  useEffect(() => {
    if (!ONLINE) return;
    supabase.from('pf_site').select('open').eq('id', 1).maybeSingle().then(({ data }) => setOpen(data ? !!data.open : true));
    listeners.push(setOpen);
    return () => {
      listeners = listeners.filter((l) => l !== setOpen);
    };
  }, []);
  return open;
}

export async function setPfSiteOpen(open: boolean) {
  const { error } = await supabase.from('pf_site').update({ open, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) throw new Error(error.message);
  listeners.forEach((l) => l(open));
}
