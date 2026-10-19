// Soutien scolaire : liste des élèves suivis (groupes de soutien) et création d'un nouveau suivi.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TabBar } from '../../components/TabBar';
import { GlobalSummary } from '../../components/Billing';
import { TutoringTile } from '../../components/TutoringTile';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, isTutoring, SUBJECTS, type Track } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { createTutoring, durationLabel, trackLabel } from '../../lib/tutoring';
import { ALL_LEVELS } from '../../lib/units';
import { frDate } from '../../lib/dates';
import { Icon } from '../../components/Icon';

export function Soutien() {
  const nav = useNavigate();
  const list = useLiveQuery(async () => {
    const groups = (await db.groups.filter((g) => isTutoring(g)).toArray()).sort((a, b) => a.name.localeCompare(b.name));
    return Promise.all(
      groups.map(async (g) => {
        const ss = await db.tutoringSessions.where('groupId').equals(g.id).toArray();
        const waiting = await db.tutoringFiles.where('groupId').equals(g.id).filter((f) => !f.sessionId && f.byStudent).count();
        const last = ss.map((s) => s.date).sort().pop();
        return { g, count: ss.length, minutes: ss.reduce((a, s) => a + s.duration, 0), last, waiting };
      }),
    );
  });
  const [creating, setCreating] = useState(false);
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('onglet') === 'recap' ? 'recap' : 'suivis';
  if (!list) return null;
  const active = list.filter((x) => !x.g.archived);
  const archived = list.filter((x) => x.g.archived);

  return (
    <div className="page stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>
          Soutien
        </h1>
        <TabBar
          tabs={[
            ['suivis', 'Suivis'],
            ['recap', 'Récapitulatif'],
          ]}
          current={tab}
          onChange={(t) => setParams({ onglet: t }, { replace: true })}
        />
        {!creating && tab === 'suivis' && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> Nouveau suivi
          </button>
        )}
      </div>
      {tab === 'recap' && <GlobalSummary teacherId={session!.id} />}
      {tab === 'suivis' && (
        <>
      {creating && <NewTutoring onDone={(id) => (setCreating(false), id && nav(`/prof/soutien/${id}`))} />}
      {!active.length && !creating && (
        <div className="notice">
          Aucun élève suivi pour l'instant. Un suivi réunit un élève (ou 2-3 élèves travaillant ensemble) et les matières travaillées.
        </div>
      )}
      <div className="grid3">
        {active.map(({ g }) => (
          <TutoringTile key={g.id} group={g} teacherId={session!.id} />
        ))}
      </div>
      {archived.length > 0 && (
        <details>
          <summary>Suivis archivés ({archived.length})</summary>
          <ul>
            {archived.map(({ g }) => (
              <li key={g.id}>
                <Link to={`/prof/soutien/${g.id}`}>
                  {g.name} ({g.schoolYear})
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
        </>
      )}
    </div>
  );
}

function NewTutoring({ onDone }: { onDone: (id?: string) => void }) {
  const { session } = useAuth();
  const [students, setStudents] = useState([{ firstName: '', lastName: '' }]);
  const [tracks, setTracks] = useState<Track[]>([{ subject: SUBJECTS[0], level: '3e' }]);
  const [busy, setBusy] = useState('');
  const ok = students.every((s) => s.firstName.trim() && s.lastName.trim()) && tracks.length > 0;

  async function create() {
    setBusy('Création du suivi et du compte élève…');
    try {
      const g = await createTutoring(
        session!.id,
        students.map((s) => ({ firstName: s.firstName.trim(), lastName: s.lastName.trim() })),
        tracks,
      );
      onDone(g.id);
    } catch (e) {
      setBusy('Erreur : ' + (e as Error).message);
    }
  }

  return (
    <div className="panel stack">
      <h3 className="panel-title">Nouveau suivi</h3>
      <div className="stack" style={{ gap: 8 }}>
        <b className="small">Élève(s)</b>
        {students.map((s, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <input
              placeholder="Prénom"
              value={s.firstName}
              autoFocus={i === students.length - 1}
              onChange={(e) => setStudents(students.map((x, j) => (j === i ? { ...x, firstName: e.target.value } : x)))}
            />
            <input
              placeholder="Nom"
              value={s.lastName}
              onChange={(e) => setStudents(students.map((x, j) => (j === i ? { ...x, lastName: e.target.value } : x)))}
            />
            {students.length > 1 && (
              <button className="btn small ghost" title="Retirer" onClick={() => setStudents(students.filter((_, j) => j !== i))}>
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        ))}
        {students.length < 4 && (
          <div>
            <button className="btn small ghost" onClick={() => setStudents([...students, { firstName: '', lastName: '' }])}>
              + Un autre élève (binôme, frères et sœurs)
            </button>
          </div>
        )}
        <span className="small muted">Un élève déjà présent dans une de vos classes garde son compte : il retrouve tout au même endroit.</span>
      </div>
      <TracksEditor tracks={tracks} onChange={setTracks} />
      <div className="row">
        <button className="btn primary" disabled={!ok || !!busy} onClick={create}>
          Créer le suivi
        </button>
        <button className="btn ghost" onClick={() => onDone()}>
          Annuler
        </button>
        {busy && <span className="small">{busy}</span>}
      </div>
    </div>
  );
}

// Matières suivies et niveau de chacune
export function TracksEditor({ tracks, onChange }: { tracks: Track[]; onChange: (t: Track[]) => void }) {
  const free = SUBJECTS.filter((s) => !tracks.some((t) => t.subject === s));
  return (
    <div className="stack" style={{ gap: 8 }}>
      <b className="small">Matières suivies</b>
      {tracks.map((t, i) => (
        <div key={i} className="row" style={{ gap: 8 }}>
          <select value={t.subject} onChange={(e) => onChange(tracks.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)))}>
            {[t.subject, ...free].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select value={t.level} onChange={(e) => onChange(tracks.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)))}>
            {ALL_LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          {tracks.length > 1 && (
            <button className="btn small ghost" title="Retirer" onClick={() => onChange(tracks.filter((_, j) => j !== i))}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      ))}
      {free.length > 0 && (
        <div>
          <button className="btn small ghost" onClick={() => onChange([...tracks, { subject: free.includes('Mathématiques') ? 'Mathématiques' : free[0], level: tracks[0]?.level ?? '3e' }])}>
            + Une autre matière
          </button>
        </div>
      )}
    </div>
  );
}
