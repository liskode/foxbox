import { useEffect, useState } from 'react';
import { loadRooms } from '../../lib/rooms';
import { SeatPlanTab } from '../../components/SeatPlanTab';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, isClass, SUBJECTS, type Group, shortName } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { ClassOverview, ClassEvaluations } from '../../components/ClassOverview';
import { Progression } from '../../components/Progression';
import { Trombi } from './Trombi';
import { ColorPicker } from '../../components/ColorPicker';
import { levelOfName, levelColors, applyLevelColors, setLevelColor, LEVELS, LYCEE } from '../../lib/units';
import { StatsTab } from './groups/StatsTab';
import { StudentsTab } from './groups/StudentsTab';
import { TeachersTab } from './groups/SettingsTab';
import { Icon } from '../../components/Icon';
import { TabBar } from '../../components/TabBar';
import { askForm } from '../../components/Dialog';

function schoolYear() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

// Nouvelle classe (bouton « + » de la page Élèves) ; elle prend la couleur de son niveau (déduit du nom, ex. « 4A » → 4e)
export async function createClass(teacherId: string): Promise<string | null> {
  const r = await askForm(
    'Nouvelle classe',
    [
      { key: 'name', label: 'Nom', placeholder: 'ex. 4C' },
      { key: 'subject', label: 'Matière', options: SUBJECTS.map((s) => ({ value: s, label: s })) },
    ],
    'Créer',
  );
  if (!r?.name.trim()) return null;
  const lvl = levelOfName(r.name);
  const color = lvl ? (await levelColors(teacherId))[lvl] : undefined;
  const g: Group = { id: uid(), name: r.name.trim(), schoolYear: schoolYear(), subject: r.subject, teacherIds: [teacherId], color };
  await db.groups.put(g);
  return g.id;
}

export function Groups({ embedded = false }: { embedded?: boolean }) {
  const { session } = useAuth();
  const groups = useLiveQuery(() => db.groups.filter(isClass).toArray(), [], []);
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
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Couleurs des niveaux</h3>
        <span className="small muted">Toutes les classes d'un même niveau (déduit du début du nom : « 4A… » → 4e, « 2B… » → 2nde, « 1G… » → 1re, « TG… » ou « Tle… » → Tle) prennent sa couleur.</span>
        <div className="row" style={{ gap: 24 }}>
          {[...LEVELS, ...LYCEE].map((l) => (
            <div key={l} className="row" style={{ gap: 8 }}>
              <b>{l}</b>
              <ColorPicker value={colors[l]} onChange={(c) => setLevelColor(session!.id, l, c)} title={`Couleur des classes de ${l}`} />
            </div>
          ))}
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
  const { session } = useAuth();
  const rooms = useLiveQuery(() => loadRooms(session!.id), [session?.id], []);
  const [choosing, setChoosing] = useState(false);
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
  const project = (planId: string) => window.open(`#/prof/plan/${group.id}/${planId}`, 'foxbox-plan', 'popup,width=1400,height=900');
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
              <div style={{ position: 'relative' }}>
                <button
                  className="btn"
                  title="Ouvre le plan de classe en grand dans une fenêtre, pour le tableau"
                  onClick={() => (plans.length > 1 ? setChoosing(!choosing) : project(plans[0].id))}
                >
                  <Icon name="screen" /> Projeter le plan
                </button>
                {/* Plusieurs plans : choix de la salle (menu, pour que la fenêtre s'ouvre directement au clic, y compris dans Safari) */}
                {choosing && (
                  <div className="panel pop stack" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, zIndex: 20, gap: 8, minWidth: 220 }}>
                    <b className="small">Quelle salle ?</b>
                    {plans.map((p) => (
                      <button key={p.id} className="btn small ghost" style={{ justifyContent: 'flex-start' }} onClick={() => (setChoosing(false), project(p.id))}>
                        {rooms.find((x) => x.id === p.roomId)?.name ?? 'Salle'}
                        {p.name && p.name !== 'Plan' ? ` · ${p.name}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
