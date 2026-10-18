import { useEffect, useState } from 'react';
import { SeatPlanTab } from '../../components/SeatPlanTab';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, isClass, SUBJECTS, CLASS_COLORS, type Group, shortName } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { ClassOverview, ClassEvaluations } from '../../components/ClassOverview';
import { Progression } from '../../components/Progression';
import { Trombi } from './Trombi';
import { levelOfName, levelColors, applyLevelColors, setLevelColor, LEVELS } from '../../lib/units';
import { StatsTab } from './groups/StatsTab';
import { StudentsTab } from './groups/StudentsTab';
import { TeachersTab } from './groups/SettingsTab';
import { Icon } from '../../components/Icon';
import { TabBar } from '../../components/TabBar';

function schoolYear() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

export function Groups({ embedded = false }: { embedded?: boolean }) {
  const { session } = useAuth();
  const nav = useNavigate();
  const groups = useLiveQuery(() => db.groups.filter(isClass).toArray(), [], []);
  const counts = useLiveQuery(
    async () => {
      const ms = await db.memberships.toArray();
      const m = new Map<string, number>();
      ms.forEach((x) => m.set(x.groupId, (m.get(x.groupId) ?? 0) + 1));
      return m;
    },
    [],
    new Map<string, number>(),
  );
  const [name, setName] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);

  async function create() {
    if (!name.trim()) return;
    // Couleur : celle du niveau de la classe (déduit du nom, ex. « 4A » → 4e)
    const lvl = levelOfName(name);
    const color = lvl ? (await levelColors(session!.id))[lvl] : undefined;
    const g: Group = { id: uid(), name: name.trim(), schoolYear: schoolYear(), subject, teacherIds: [session!.id], color };
    await db.groups.put(g);
    nav(`/prof/classes/${g.id}`);
  }

  const active = groups.filter((g) => !g.archived);
  const colors = useLiveQuery(() => levelColors(session!.id), [session], {} as Record<string, string>);
  // Les classes prennent la couleur de leur niveau
  useEffect(() => {
    applyLevelColors(session!.id);
  }, [session, groups.length]);
  const archived = groups.filter((g) => g.archived);

  return (
    <div className={embedded ? 'stack' : 'page stack'}>
      <h1 className={embedded ? '' : 'title'} style={embedded ? { margin: 0 } : undefined}>
        Classes
      </h1>
      <div className="grid3">
        {active
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
          .map((g) => (
            <div key={g.id} className="panel stack" style={{ background: g.color ?? 'var(--paper)', gap: 8 }}>
              <Link to={`/prof/classes/${g.id}`} className="stack" style={{ textDecoration: 'none', gap: 8 }}>
                <h2 style={{ margin: 0 }}>{shortName(g.name)}</h2>
                <div className="muted">
                  {g.subject} · {g.schoolYear}
                </div>
                <div>
                  <b>{counts.get(g.id) ?? 0}</b> élève(s)
                </div>
              </Link>
            </div>
          ))}
      </div>
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Couleurs des niveaux</h3>
        <span className="small muted">Toutes les classes d'un même niveau (déduit du début du nom : « 4A… » → 4e) prennent sa couleur.</span>
        {LEVELS.map((l) => (
          <div key={l} className="row" style={{ gap: 8 }}>
            <b style={{ width: 34 }}>{l}</b>
            {CLASS_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.name}
                onClick={() => setLevelColor(session!.id, l, c.value)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: c.value,
                  cursor: 'pointer',
                  border: colors[l] === c.value ? '3px solid var(--ink)' : '1.5px solid #00000033',
                  padding: 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Nouvelle classe</h3>
        <div className="row">
          <input placeholder="Nom (ex. 4e C)" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="btn primary" onClick={create}>
            Créer
          </button>
        </div>
      </div>
      {archived.length > 0 && (
        <details>
          <summary>Classes archivées ({archived.length})</summary>
          <ul>
            {archived.map((g) => (
              <li key={g.id}>
                <Link to={`/prof/classes/${g.id}`}>
                  {shortName(g.name)} ({g.schoolYear})
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function GroupPage() {
  const { id } = useParams();
  const group = useLiveQuery(async () => (await db.groups.get(id!)) ?? null, [id]);
  // Onglet gardé dans l'adresse : le retour depuis une fiche élève revient au même onglet
  const [params, setParams] = useSearchParams();
  type Tab = 'apercu' | 'progression' | 'eleves' | 'suivi' | 'trombi' | 'plan' | 'evaluations' | 'profs';
  const raw = params.get('onglet');
  const tab = ((raw === 'stats' ? 'suivi' : raw) as Tab) || 'apercu';
  const setTab = (t: string) => setParams({ onglet: t }, { replace: true });
  const count = useLiveQuery(() => db.memberships.where('groupId').equals(id!).count(), [id]);
  if (group === undefined) return null;
  if (!group) return <div className="page muted">Classe introuvable.</div>;
  const tabs = [
    ['apercu', "Vue d'ensemble"],
    ['progression', 'Progression'],
    ['eleves', 'Élèves'],
    ['trombi', 'Trombi'],
    ['plan', 'Plan de classe'],
    ['evaluations', 'Évaluations'],
    ['suivi', 'Flashcards'],
    ['profs', 'Réglages'],
  ] as const;
  const plans = group.seatPlans ?? [];
  return (
    <div className="page stack">
      {/* Bandeau à la couleur du niveau : identité de la classe ; les deux actions du cours à droite */}
      <div className="class-band" style={{ background: group.color ?? 'var(--paper)' }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 14 }}>
          <h1>{shortName(group.name)}</h1>
          <span className="muted">
            {group.subject} · {count ?? 0} élèves · {group.schoolYear} {group.archived && '· archivée'}
          </span>
          <div style={{ flex: 1 }} />
          <div className="row" style={{ gap: 8, alignSelf: 'center' }}>
            <button className="btn primary" onClick={() => setParams({ onglet: 'plan', appel: '1' }, { replace: true })}>
              <Icon name="eval" /> Faire l'appel
            </button>
            {plans.length > 0 && (
              <button
                className="btn"
                title="Ouvre le plan de classe en grand dans une fenêtre, pour le tableau"
                onClick={() => window.open(`#/prof/plan/${group.id}/${plans[0].id}`, 'foxbox-plan', 'popup,width=1400,height=900')}
              >
                <Icon name="screen" /> Projeter le plan
              </button>
            )}
          </div>
        </div>
        <TabBar tabs={tabs} current={tab} onChange={setTab} variant="underline" />
      </div>
      {tab === 'apercu' && <ClassOverview group={group} goTab={setTab} />}
      {tab === 'progression' && (
        <div className="stack">
          <Progression group={group} />
        </div>
      )}
      {tab === 'suivi' && <StatsTab groupId={group.id} />}
      {tab === 'eleves' && <StudentsTab group={group} />}
      {tab === 'trombi' && <Trombi groupId={group.id} />}
      {tab === 'plan' && <SeatPlanTab group={group} />}
      {tab === 'evaluations' && <ClassEvaluations group={group} />}
      {tab === 'profs' && <TeachersTab group={group} />}
    </div>
  );
}
