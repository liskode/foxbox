// Réglages › Démo : lien public en lecture seule, profils proposés (de vrais comptes choisis ici), texte d'accueil.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isClass, isTutoring, type Student } from '../lib/db';
import { supabase, ONLINE } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { isDemo } from '../lib/demoMode';
import { Icon } from './Icon';
import { toast } from './Toast';

interface DemoData {
  enabled?: boolean;
  intro?: string;
  prof?: string;
  eleve?: string;
  soutien?: string;
  parent?: string;
}

const byName = (a: Student, b: Student) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

export function DemoSettings() {
  const { session } = useAuth();
  const [d, setD] = useState<DemoData | null>(null);
  useEffect(() => {
    if (!ONLINE) return;
    supabase
      .from('demo_config')
      .select('data')
      .eq('teacher_id', session!.id)
      .maybeSingle()
      .then(({ data }) => setD((data?.data as DemoData) ?? {}));
  }, [session]);
  const choices = useLiveQuery(async () => {
    const groups = await db.groups.filter((g) => !g.archived).toArray();
    const ids = async (pred: (g: (typeof groups)[number]) => boolean) =>
      (await db.memberships.where('groupId').anyOf(groups.filter(pred).map((g) => g.id)).toArray()).map((m) => m.studentId);
    const load = async (list: string[]) => ((await db.students.bulkGet([...new Set(list)])).filter(Boolean) as Student[]).sort(byName);
    const classe = await load(await ids(isClass));
    const soutien = await load(await ids(isTutoring));
    const tutored = new Set(soutien.map((s) => s.id));
    const parents = (await db.parents.toArray()).filter((p) => p.studentIds.some((id) => tutored.has(id))).sort((a, b) => a.name.localeCompare(b.name));
    return { classe, soutien, parents };
  }, []);

  if (!ONLINE || isDemo() || !d || !choices) return null;
  const link = `${location.origin}${location.pathname}#/demo`;

  async function save(next: DemoData, msg?: string) {
    setD(next);
    const { error } = await supabase.from('demo_config').upsert({ teacher_id: session!.id, data: next, updated_at: new Date().toISOString() });
    if (error) return toast(`Démo non enregistrée : ${error.message}`, { error: true });
    // Démo fermée : les sessions de démo encore ouvertes sont fermées aussi
    if (next.enabled === false) await supabase.rpc('end_demo_sessions');
    if (msg) toast(msg);
  }
  const pick = (key: 'eleve' | 'soutien' | 'parent', label: string, options: { id: string; name: string }[]) => (
    <label className="field">
      {label}
      <select value={d[key] ?? ''} onChange={(e) => save({ ...d, [key]: e.target.value || undefined }, 'Profil enregistré')}>
        <option value="">— pas proposé —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="panel stack" style={{ gap: 10 }}>
      <h3 className="panel-title">
        <Icon name="screen" size={16} /> Démo en lecture seule
      </h3>
      <span className="small muted">
        Un lien ouvert à qui l’a reçu permet de découvrir FoxBox avec les profils choisis ici : on peut cliquer partout, rien n’est enregistré (le serveur refuse
        toute modification). Ce sont de vrais comptes : ne partagez le lien qu’avec des personnes de confiance, et fermez la démo après les essais.
      </span>
      <label className="row" style={{ gap: 8, fontWeight: 800 }}>
        <input
          type="checkbox"
          checked={!!d.enabled}
          onChange={(e) => save({ ...d, enabled: e.target.checked }, e.target.checked ? 'Démo ouverte' : 'Démo fermée (sessions de démo fermées)')}
        />
        Démo ouverte
      </label>
      {d.enabled && (
        <div className="row" style={{ gap: 8 }}>
          <span className="code" style={{ overflowWrap: 'anywhere' }}>
            {link}
          </span>
          <button className="btn small" onClick={() => navigator.clipboard.writeText(link).then(() => toast('Lien copié'))}>
            <Icon name="link" size={14} /> Copier le lien
          </button>
        </div>
      )}
      <div className="grid2" style={{ gap: 10 }}>
        <label className="row" style={{ gap: 8, fontWeight: 700 }}>
          <input type="checkbox" checked={d.prof === session!.id} onChange={(e) => save({ ...d, prof: e.target.checked ? session!.id : undefined }, 'Profil enregistré')} />
          Professeur (votre compte, en lecture seule)
        </label>
        {pick('eleve', 'Élève en classe', choices.classe.map((s) => ({ id: s.id, name: `${s.lastName} ${s.firstName}` })))}
        {pick('soutien', 'Élève en soutien', choices.soutien.map((s) => ({ id: s.id, name: `${s.lastName} ${s.firstName}` })))}
        {pick('parent', 'Parent d’un élève en soutien', choices.parents.map((p) => ({ id: p.id, name: p.name })))}
      </div>
      <label className="field">
        Mot d’accueil (facultatif, affiché sur la page de la démo)
        <textarea
          defaultValue={d.intro ?? ''}
          placeholder="Ex. : Merci de tester FoxBox ! Vos remarques sont les bienvenues."
          style={{ fontFamily: 'var(--font)', minHeight: 60 }}
          onBlur={(e) => e.target.value !== (d.intro ?? '') && save({ ...d, intro: e.target.value }, 'Mot d’accueil enregistré')}
        />
      </label>
    </div>
  );
}
