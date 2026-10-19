// Soutien scolaire : page d'un suivi (séances, programme, flashcards, élèves, réglages).
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isTutoring, type Group, type Student, type Track } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { addStudents, durationLabel, lastSeen, newSession, setUnitStatus, STATES, trackLabel, unitState } from '../../lib/tutoring';
import { byProgression, themeLabel, unitLabel, unitSubject } from '../../lib/units';
import { frDate } from '../../lib/dates';
import { resetPassword } from '../../lib/students';
import { TabBar } from '../../components/TabBar';
import { RichText } from '../../components/CardFace';
import { Avatar } from '../../components/Avatar';
import { StudentReport } from '../../components/StudentReport';
import { useNote } from '../../components/StudentNote';
import { FileList, UploadButton, placeLabel, whenLabel } from '../../components/Soutien';
import { showInfo } from '../../components/Dialog';
import { toast } from '../../components/Toast';
import { Icon } from '../../components/Icon';
import { TracksEditor } from './Soutien';
import { BillingPanel } from '../../components/Billing';
import { Chat } from '../../components/Chat';
import { unreadIn } from '../../lib/messages';
import { resetParentPassword, removeParentAccess } from '../../lib/parents';

export function SoutienGroup() {
  const { id } = useParams();
  const nav = useNavigate();
  const group = useLiveQuery(async () => (await db.groups.get(id!)) ?? null, [id]);
  const students = useLiveQuery(
    async () => {
      const ms = await db.memberships.where('groupId').equals(id!).toArray();
      return ((await db.students.bulkGet(ms.map((m) => m.studentId))).filter(Boolean) as Student[]).sort((a, b) => a.firstName.localeCompare(b.firstName));
    },
    [id],
    [],
  );
  const [params, setParams] = useSearchParams();
  type Tab = 'seances' | 'programme' | 'flashcards' | 'reglements' | 'messages' | 'eleves' | 'reglages';
  const { session } = useAuth();
  const unread = useLiveQuery(
    async () => {
      let n = 0;
      for (const s of students) for (const t of ['eleve', 'parents'] as const) n += await unreadIn(session!.id, session!.id, s.id, t);
      return n;
    },
    [students, session?.id],
    0,
  );
  const tab = (params.get('onglet') as Tab) || 'seances';
  if (group === undefined) return null;
  if (!group || !isTutoring(group)) return <div className="page muted">Suivi introuvable.</div>;
  const tabs = [
    ['seances', 'Séances'],
    ['programme', 'Programme'],
    ['flashcards', 'Flashcards'],
    ['reglements', 'Règlements'],
    ['messages', unread ? `Messages (${unread})` : 'Messages'],
    ['eleves', students.length > 1 ? 'Élèves' : 'Élève'],
    ['reglages', 'Réglages'],
  ] as const;

  return (
    <div className="page stack">
      <div className="class-band" style={{ background: 'var(--calm)' }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 14 }}>
          <h1>{group.name}</h1>
          <span className="muted">
            {(group.tracks ?? []).map(trackLabel).join(' · ')} {group.archived && '· archivé'}
          </span>
          <div style={{ flex: 1 }} />
          <button
            className="btn primary"
            style={{ alignSelf: 'center' }}
            onClick={async () => {
              const s = await newSession(group);
              nav(`/prof/soutien/${group.id}/seance/${s.id}`);
            }}
          >
            <Icon name="plus" /> Nouvelle séance
          </button>
        </div>
        <TabBar tabs={tabs} current={tab} onChange={(t) => setParams({ onglet: t }, { replace: true })} variant="underline" />
      </div>
      {tab === 'seances' && <SessionsTab group={group} />}
      {tab === 'programme' && <ProgrammeTab group={group} />}
      {tab === 'flashcards' && (
        <div className="stack">
          {students.map((s) => (
            <div key={s.id} className="stack" style={{ gap: 8 }}>
              {students.length > 1 && <h2 style={{ margin: 0 }}>{s.firstName}</h2>}
              <StudentReport studentId={s.id} />
            </div>
          ))}
        </div>
      )}
      {tab === 'reglements' && (
        <div className="stack">
          {students.map((s) => (
            <BillingPanel key={s.id} teacherId={session!.id} student={s} showName={students.length > 1} />
          ))}
        </div>
      )}
      {tab === 'messages' && <MessagesTab students={students} />}
      {tab === 'eleves' && <StudentsTab group={group} students={students} />}
      {tab === 'reglages' && <SettingsTab group={group} />}
    </div>
  );
}

function SessionsTab({ group }: { group: Group }) {
  const { session } = useAuth();
  const sessions = useLiveQuery(async () => (await db.tutoringSessions.where('groupId').equals(group.id).toArray()).sort((a, b) => b.date.localeCompare(a.date) || (b.start ?? '').localeCompare(a.start ?? '')), [group.id], []);
  const waiting = useLiveQuery(() => db.tutoringFiles.where('groupId').equals(group.id).filter((f) => !f.sessionId).sortBy('createdAt'), [group.id], []);
  const checks = useLiveQuery(() => db.homeworkChecks.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray(), [sessions], []);
  const units = useLiveQuery(() => db.units.toArray(), [], []);
  const total = sessions.reduce((a, s) => a + s.duration, 0);

  return (
    <div className="stack">
      <div className="panel calm stack" style={{ gap: 8 }}>
        <div className="spread">
          <h3 className="panel-title">
            <Icon name="file" size={16} /> Pour la prochaine séance
          </h3>
          <UploadButton groupId={group.id} authorId={session!.id} byStudent={false} />
        </div>
        {waiting.length ? (
          <FileList files={waiting} canDelete={() => true} />
        ) : (
          <span className="small muted">Les documents déposés par l'élève depuis son espace apparaissent ici, puis sont rattachés à la séance suivante.</span>
        )}
      </div>
      {sessions.length > 0 && (
        <span className="small muted">
          {sessions.length} séance(s) · {durationLabel(total)}
        </span>
      )}
      {!sessions.length && <div className="notice">Aucune séance. « Nouvelle séance » ouvre la fiche à remplir pendant ou après le cours.</div>}
      {sessions.map((s) => {
        const points = s.unitIds.map((u) => units.find((x) => x.id === u)).filter(Boolean);
        const doneBy = checks.filter((c) => c.sessionId === s.id && c.done).length;
        return (
          <Link key={s.id} to={`/prof/soutien/${group.id}/seance/${s.id}`} className="panel strong session-line">
            <div className="session-date">
              {s.date.slice(8, 10)}
              <small>{['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][Number(s.date.slice(5, 7)) - 1]}</small>
            </div>
            <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
              <div className="row" style={{ gap: 8 }}>
                <b>{whenLabel(s)}</b>
                <span className="tag plain">
                  <Icon name={s.place === 'en ligne' ? 'laptop' : 'home'} size={13} /> {placeLabel(s)}
                </span>
                {s.homework.trim() && <span className={'tag ' + (doneBy ? 'ok' : 'plain')}>{doneBy ? 'Travail fait' : 'Travail donné'}</span>}
              </div>
              {points.length > 0 && <span className="small">{points.map((u) => unitLabel(u!)).join(' · ')}</span>}
              {s.done.trim() && (
                <div className="muted" style={{ maxHeight: '2.9em', overflow: 'hidden', fontSize: '0.9rem' }}>
                  <RichText text={s.done} />
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// Programme : tous les points de la progression de chaque matière suivie, avec leur avancement pour ce suivi
function ProgrammeTab({ group }: { group: Group }) {
  const units = useLiveQuery(() => db.units.toArray(), [], []);
  const sessions = useLiveQuery(() => db.tutoringSessions.where('groupId').equals(group.id).toArray(), [group.id], []);
  const nav = useNavigate();
  const seen = lastSeen(sessions, units);
  return (
    <div className="grid2" style={{ alignItems: 'start' }}>
      {(group.tracks ?? []).map((t) => {
        const seqs = units.filter((u) => u.kind === 'sequence' && u.level === t.level && unitSubject(u) === t.subject).sort(byProgression);
        const all = seqs.flatMap((q) => [q, ...units.filter((u) => u.parentId === q.id)]);
        const counted = all.filter((u) => u.kind === 'seance' || !units.some((x) => x.parentId === u.id));
        const ok = counted.filter((u) => ['vu', 'acquis'].includes(unitState(group, seen, u))).length;
        return (
          <div key={t.subject} className="panel stack" style={{ gap: 6 }}>
            <div className="spread">
              <h3 className="panel-title">{trackLabel(t)}</h3>
              {counted.length > 0 && (
                <span className="small muted">
                  {ok} / {counted.length} vus
                </span>
              )}
            </div>
            {!seqs.length && (
              <div className="notice stack" style={{ gap: 8 }}>
                <span>
                  Pas encore de progression de {t.subject} en {t.level}. Créez-la une fois dans la Progression : elle servira à tous vos élèves de ce
                  niveau.
                </span>
                <div>
                  <button
                    className="btn small"
                    onClick={() => {
                      try {
                        localStorage.setItem('foxbox-subject', t.subject);
                      } catch {
                        /* navigation privée */
                      }
                      nav('/prof/progression');
                    }}
                  >
                    Ouvrir la Progression de {t.subject}
                  </button>
                </div>
              </div>
            )}
            {seqs.map((q, i) => {
              const kids = units.filter((u) => u.parentId === q.id).sort((a, b) => a.order - b.order);
              return (
                <div key={q.id} className="stack" style={{ gap: 2 }}>
                  {(i === 0 || seqs[i - 1].theme !== q.theme) && (
                    <div className="small" style={{ fontWeight: 900, marginTop: 6, color: 'var(--ink-soft)' }}>
                      {themeLabel(q.theme, q.level, t.subject)}
                    </div>
                  )}
                  <ProgItem group={group} unit={q} seen={seen} bold />
                  {kids.map((k) => (
                    <div key={k.id} style={{ paddingLeft: 16 }}>
                      <ProgItem group={group} unit={k} seen={seen} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ProgItem({ group, unit, seen, bold = false }: { group: Group; unit: import('../../lib/db').Unit; seen: Map<string, string>; bold?: boolean }) {
  const st = unitState(group, seen, unit);
  const def = STATES.find((s) => s.key === st)!;
  return (
    <div className="prog-item">
      <span className="name small" style={{ fontWeight: bold ? 800 : 500 }}>
        {unitLabel(unit)}
      </span>
      {seen.has(unit.id) && <span className="small muted">{seen.get(unit.id)!.slice(8, 10)}/{seen.get(unit.id)!.slice(5, 7)}</span>}
      <select
        className={'tag ' + def.cls}
        style={{ border: 'none', padding: '2px 4px', fontSize: '0.8rem' }}
        value={st}
        onChange={(e) => setUnitStatus(group, unit.id, e.target.value as (typeof STATES)[number]['key'])}
        title="Avancement pour ce suivi"
      >
        {STATES.map((s) => (
          <option key={s.key} value={s.key} disabled={s.key === 'vu' && !seen.has(unit.id)}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StudentsTab({ group, students }: { group: Group; students: Student[] }) {
  const [adding, setAdding] = useState<{ firstName: string; lastName: string } | null>(null);
  return (
    <div className="stack">
      {students.map((s) => (
        <StudentCardPanel key={s.id} student={s} group={group} />
      ))}
      <div className="row">
        <Link className="btn" to={`/prof/classes/${group.id}/fiches`}>
          <Icon name="print" /> Imprimer les identifiants
        </Link>
        {adding ? (
          <form
            className="row"
            style={{ gap: 8 }}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!adding.firstName.trim() || !adding.lastName.trim()) return;
              await addStudents(group, [{ firstName: adding.firstName.trim(), lastName: adding.lastName.trim() }]);
              setAdding(null);
              toast('Élève ajouté au suivi');
            }}
          >
            <input placeholder="Prénom" autoFocus value={adding.firstName} onChange={(e) => setAdding({ ...adding, firstName: e.target.value })} />
            <input placeholder="Nom" value={adding.lastName} onChange={(e) => setAdding({ ...adding, lastName: e.target.value })} />
            <button className="btn primary small" type="submit">
              Ajouter
            </button>
            <button className="btn ghost small" type="button" onClick={() => setAdding(null)}>
              Annuler
            </button>
          </form>
        ) : (
          <button className="btn ghost" onClick={() => setAdding({ firstName: '', lastName: '' })}>
            + Ajouter un élève (binôme)
          </button>
        )}
      </div>
    </div>
  );
}

function StudentCardPanel({ student, group }: { student: Student; group: Group }) {
  const { tutor, family, setTutor } = useNote(student.id);
  const [draft, setDraft] = useState<typeof tutor | null>(null);
  const info = draft ?? tutor ?? {};
  const save = () => draft && setTutor(draft).then(() => setDraft(null));
  return (
    <div className="panel stack">
      <div className="row" style={{ gap: 14 }}>
        <Avatar student={student} size={64} editable />
        <div className="stack" style={{ gap: 4, flex: 1 }}>
          <h2 style={{ margin: 0 }}>
            {student.firstName} {student.lastName}
          </h2>
          <span className="small">
            Identifiant : <span className="code">{student.login}</span> · mot de passe : <span className="code">{student.password}</span>
          </span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Link className="btn small" to={`/prof/eleves/${student.id}?classe=${group.id}`}>
            <Icon name="user" size={15} /> Fiche élève
          </Link>
          <Link className="btn small" to={`/prof/eleves/${student.id}/famille`}>
            <Icon name="family" size={15} /> Famille{family?.contacts.length ? ` (${family.contacts.length})` : ''}
          </Link>
          <button
            className="btn small ghost"
            onClick={async () => {
              if (!confirm(`Donner un nouveau mot de passe à ${student.firstName} ?`)) return;
              await resetPassword(student.id);
              const s = await db.students.get(student.id);
              await showInfo('Nouveau mot de passe', `${student.firstName} se connecte avec ${s?.login} / ${s?.password}`);
            }}
          >
            <Icon name="key" size={15} /> Nouveau mot de passe
          </button>
        </div>
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: 2, minWidth: 200 }}>
          Établissement
          <input value={info.school ?? ''} placeholder="Collège, lycée…" onChange={(e) => setDraft({ ...info, school: e.target.value })} onBlur={save} />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 120 }}>
          Classe
          <input value={info.className ?? ''} placeholder="3e B" onChange={(e) => setDraft({ ...info, className: e.target.value })} onBlur={save} />
        </label>
      </div>
      <label className="field">
        Objectifs
        <textarea
          value={info.goals ?? ''}
          placeholder="Brevet, bac, remise à niveau, méthode de travail…"
          onChange={(e) => setDraft({ ...info, goals: e.target.value })}
          onBlur={save}
          style={{ fontFamily: 'var(--font)', minHeight: 60 }}
        />
      </label>
      <span className="small muted">
        <Icon name="lock" size={13} /> Visible par vous seul · enregistré en quittant un champ
      </span>
      <ParentAccesses student={student} />
    </div>
  );
}

// Comptes parents de l'élève (créés depuis la fiche Famille)
export function ParentAccesses({ student }: { student: Student }) {
  const parents = useLiveQuery(() => db.parents.where('studentIds').equals(student.id).toArray(), [student.id], []);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <b className="small">Accès parents</b>
      {parents.map((p) => (
        <div key={p.id} className="row small" style={{ gap: 8 }}>
          <span style={{ minWidth: 140 }}>{p.name}</span>
          <span>
            Identifiant : <span className="code">{p.login}</span> · mot de passe : <span className="code">{p.password}</span>
          </span>
          <button
            className="btn small ghost"
            onClick={async () => {
              if (!confirm(`Donner un nouveau mot de passe à ${p.name} ?`)) return;
              await resetParentPassword(p.id);
              const n = await db.parents.get(p.id);
              await showInfo('Nouveau mot de passe', `${p.name} se connecte avec ${n?.login} / ${n?.password}`);
            }}
          >
            <Icon name="key" size={14} /> Nouveau mot de passe
          </button>
          <button
            className="btn small ghost"
            onClick={async () => {
              if (!confirm(`Retirer l'accès de ${p.name} au suivi de ${student.firstName} ?`)) return;
              await removeParentAccess(p.id, student.id);
              toast('Accès retiré');
            }}
          >
            <Icon name="x" size={14} /> Retirer l'accès
          </button>
        </div>
      ))}
      <span className="small muted">
        {parents.length ? '' : 'Aucun accès parent. '}
        Les accès se créent depuis la fiche{' '}
        <Link to={`/prof/eleves/${student.id}/famille`}>Famille</Link>, contact par contact.
      </span>
    </div>
  );
}

// Messages : pour chaque élève, le fil avec l'élève et le fil avec ses parents (séparés)
function MessagesTab({ students }: { students: Student[] }) {
  const { session } = useAuth();
  const me = useLiveQuery(() => db.teachers.get(session!.id), [session?.id]);
  if (!me) return null;
  return (
    <div className="stack">
      {students.map((s) => (
        <div key={s.id} className="stack" style={{ gap: 8 }}>
          {students.length > 1 && <h2 style={{ margin: 0 }}>{s.firstName}</h2>}
          <div className="grid2" style={{ alignItems: 'start' }}>
            <Chat teacherId={me.id} studentId={s.id} thread="eleve" me={{ id: me.id, name: me.name }} title={`Avec ${s.firstName}`} hint="Lu par l'élève, pas par ses parents" />
            <Chat teacherId={me.id} studentId={s.id} thread="parents" me={{ id: me.id, name: me.name }} title="Avec les parents" hint="Lu par les parents, pas par l'élève" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ group }: { group: Group }) {
  const nav = useNavigate();
  const [tracks, setTracks] = useState<Track[]>(group.tracks ?? []);
  const changed = JSON.stringify(tracks) !== JSON.stringify(group.tracks ?? []);
  return (
    <div className="stack">
      <div className="panel stack">
        <label className="field" style={{ maxWidth: 360 }}>
          Nom du suivi
          <input defaultValue={group.name} onBlur={(e) => e.target.value.trim() && db.groups.update(group.id, { name: e.target.value.trim() })} />
        </label>
        <TracksEditor tracks={tracks} onChange={setTracks} />
        {changed && (
          <div>
            <button className="btn primary small" onClick={() => db.groups.update(group.id, { tracks, subject: tracks[0].subject }).then(() => toast('Matières enregistrées'))}>
              Enregistrer les matières
            </button>
          </div>
        )}
      </div>
      <div className="panel stack" style={{ gap: 8 }}>
        <h3 className="panel-title">Fin du suivi</h3>
        <span className="small muted">Un suivi archivé disparaît de la liste ; l'élève garde son historique.</span>
        <div>
          <button
            className="btn"
            onClick={async () => {
              await db.groups.update(group.id, { archived: !group.archived });
              toast(group.archived ? 'Suivi réactivé' : 'Suivi archivé', { undo: () => db.groups.update(group.id, { archived: group.archived }) });
              if (!group.archived) nav('/prof/soutien');
            }}
          >
            {group.archived ? 'Réactiver le suivi' : 'Archiver le suivi'}
          </button>
        </div>
      </div>
    </div>
  );
}
