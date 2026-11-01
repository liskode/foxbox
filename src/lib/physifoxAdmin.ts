import { useEffect, useState } from 'react';
import { ONLINE, supabase } from './supabase';

// L'onglet Physifox n'apparaît qu'aux administrateurs (le serveur vérifie de son côté)
export function usePfAdmin(userId?: string) {
  const [admin, setAdmin] = useState(!ONLINE);
  useEffect(() => {
    if (!ONLINE || !userId) return;
    supabase.from('pf_admins').select('user_id').eq('user_id', userId).maybeSingle().then(({ data }) => setAdmin(!!data));
  }, [userId]);
  return admin;
}
