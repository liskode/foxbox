// Espace Trombi : le professeur mémorise les prénoms de ses élèves à partir des photos.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, type Rating, type Student, type TrombiCard } from '../../lib/db';
import { INTERVALS, nextBox } from '../../lib/leitner';
import { addDays, frDate, today } from '../../lib/dates';
import { usePhoto } from '../../components/Avatar';
import { Boxes } from '../../components/widgets';

interface Entry {
  student: Student;
  groups: string[];
}

function Photo({ student, size }: { student: Student; size: number | string }) {
  const url = usePhoto(student.photoId);
  return (
    <div
      style={{
        width: size,
        aspectRatio: '1',
        borderRadius: 18,
        border: 'var(--border)',
        overflow: 'hidden',
        background: 'var(--divers)',
        margin: '0 auto',
      }}
    >
      {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </div>
  );
}

function Session({ entries, teacherId, onEnd }: { entries: Entry[]; teacherId: string; onEnd: () => void }) {
  const [queue, setQueue] = useState<Entry[] | null>(null);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const shownAt = useRef(0);

  // La file est construite une seule fois : une mise à jour de la liste ne doit pas relancer la séance
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !entries.length) return;
    started.current = true;
    (async () => {
      const day = today();
      const cards = new Map((await db.trombi.where('teacherId').equals(teacherId).toArray()).map((c) => [c.studentId, c]));
      const due = entries
        .filter((e) => cards.has(e.student.id) && cards.get(e.student.id)!.due <= day)
        .sort((a, b) => cards.get(a.student.id)!.due.localeCompare(cards.get(b.student.id)!.due));
      const fresh = entries.filter((e) => !cards.has(e.student.id)).sort(() => Math.random() - 0.5);
      setQueue([...due, ...fresh].slice(0, 20));
    })();
  }, [entries, teacherId]);

  const show = useCallback(() => {
    setShown((s) => {
      if (!s) shownAt.current = Date.now();
      return true;
    });
  }, []);

  const answer = useCallback(
    async (r: Rating) => {
      if (!queue || !shown || Date.now() - shownAt.current < 500) return;
      const e = queue[i];
      const id = `${teacherId}|${e.student.id}`;
      const prev = await db.trombi.get(id);
      const box = nextBox(prev?.box ?? 0, r, 'strict');
      const card: TrombiCard = { id, teacherId, studentId: e.student.id, box, due: addDays(today(), INTERVALS[box]) };
      await db.trombi.put(card);
      // Un visage oublié revient en fin de séance
      if (r === 'forgot') setQueue((q) => [...q!, e]);
      setShown(false);
      setI((n) => n + 1);
    },
    [queue, i, shown, teacherId],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        show();
      } else if (ev.key === '1') answer('forgot');
      else if (ev.key === '2') answer('hard');
      else if (ev.key === '3') answer('easy');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, show]);

  if (!queue) return null;
  const e = queue[i];
  if (!e)
    return (
      <div className="panel stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <img src="./logo.png" alt="" style={{ width: 110 }} />
        <h2>{queue.length ? 'Séance terminée !' : 'Rien à revoir aujourd’hui 🎉'}</h2>
        <button className="btn primary" onClick={onEnd}>
          Retour
        </button>
      </div>
    );

  return (
    <div className="review">
      <div className="spread">
        <a href="#" className="small muted" onClick={(ev) => (ev.preventDefault(), onEnd())}>
          ✕ Arrêter
        </a>
        <span className="small muted">
          {i + 1} / {queue.length}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>
      <div className="flip stack" onClick={show} style={{ cursor: 'pointer', flexDirection: 'column', gap: 14 }}>
        <Photo student={e.student} size="min(320px, 70vw)" />
        {shown ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.7rem', fontWeight: 900 }}>{e.student.firstName}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{e.student.lastName}</div>
            <div className="muted small">{e.groups.join(' · ')}</div>
          </div>
        ) : (
          <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>Qui est-ce ?</div>
        )}
      </div>
      {!shown ? (
        <button className="btn primary big" style={{ justifyContent: 'center' }} onClick={show}>
          Voir le nom
        </button>
      ) : (
        <div className="answers">
          <button className="forgot" onClick={() => answer('forgot')}>
            Je ne sais pas
          </button>
          <button className="hard" onClick={() => answer('hard')}>
            Dur
          </button>
          <button className="easy" onClick={() => answer('easy')}>
            Facile
          </button>
        </div>
      )}
    </div>
  );
}

export function Trombi() {
  const { session } = useAuth();
  const teacherId = session!.id;
  const groups = useLiveQuery(
    async () =>
      (await db.groups.filter((g) => !g.archived && g.teacherIds.includes(teacherId)).toArray()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [teacherId],
    [],
  );
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const sel = selected ?? new Set(groups.map((g) => g.id));
  const [mode, setMode] = useState<'galerie' | 'session'>('galerie');
  const [hideNames, setHideNames] = useState(false);

  const entries = useLiveQuery(async () => {
    const map = new Map<string, Entry>();
    for (const g of groups.filter((x) => sel.has(x.id))) {
      const ms = await db.memberships.where('groupId').equals(g.id).toArray();
      const students = await db.students.bulkGet(ms.map((m) => m.studentId));
      for (const s of students) {
        if (!s) continue;
        const e = map.get(s.id) ?? { student: s, groups: [] };
        e.groups.push(g.name);
        map.set(s.id, e);
      }
    }
    return [...map.values()].sort((a, b) => a.student.lastName.localeCompare(b.student.lastName));
  }, [groups, [...sel].join()], []);
  const withPhoto = useMemo(() => entries.filter((e) => e.student.photoId), [entries]);
  const missing = entries.length - withPhoto.length;

  const progress = useLiveQuery(async () => {
    const cards = new Map((await db.trombi.where('teacherId').equals(teacherId).toArray()).map((c) => [c.studentId, c]));
    const dist = [0, 0, 0, 0, 0, 0, 0, 0];
    let due = 0;
    let nextDue: string | undefined;
    for (const e of withPhoto) {
      const c = cards.get(e.student.id);
      dist[c?.box ?? 0]++;
      if (!c || c.due <= today()) due++;
      else if (!nextDue || c.due < nextDue) nextDue = c.due;
    }
    return { dist, due, nextDue };
  }, [withPhoto, teacherId, mode]);

  const toggle = (id: string) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };

  if (mode === 'session')
    return (
      <div className="page">
        <Session entries={withPhoto} teacherId={teacherId} onEnd={() => setMode('galerie')} />
      </div>
    );

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const fresh = progress?.dist[0] ?? 0;
  const learning = progress ? sum(progress.dist.slice(1, 4)) : 0;
  const known = progress ? sum(progress.dist.slice(4)) : 0;

  return (
    <div className="page stack">
      <div className="spread">
        <h1 className="title" style={{ margin: 0 }}>Trombi</h1>
        <div className="row">
          {groups.map((g) => (
            <button key={g.id} className={'chip' + (sel.has(g.id) ? '' : ' off')} style={{ background: 'var(--matiere)' }} onClick={() => toggle(g.id)}>
              {g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>Mémoriser les prénoms</h3>
          <div>
            Sur {withPhoto.length} élève(s) : <b>{fresh}</b> jamais vu(s) · <b>{learning}</b> en cours d'apprentissage (boîtes 1 à 3) ·{' '}
            <b>{known}</b> bien retenu(s) (boîtes 4 à 7)
          </div>
          <div>
            <b>{progress?.due ?? 0}</b> à revoir aujourd'hui
            {!progress?.due && progress?.nextDue && <> · prochaine révision le {frDate(progress.nextDue)}</>}
          </div>
          <div className="row">
            <button className="btn primary big" disabled={!progress?.due} onClick={() => setMode('session')}>
              S'entraîner ({Math.min(20, progress?.due ?? 0)})
            </button>
          </div>
          <span className="small muted">
            Même principe que les élèves : une photo, vous cherchez le prénom, puis Facile / Dur / Je ne sais pas. Un visage
            oublié revient en fin de séance.
          </span>
        </div>
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>Mes boîtes</h3>
          {progress && <Boxes dist={progress.dist} />}
        </div>
      </div>

      {missing > 0 && (
        <div className="notice small">
          {missing} élève(s) sans photo (non inclus). Ajoutez les photos depuis Classes › Élèves (« Importer des photos » ou clic sur
          l'avatar).
        </div>
      )}

      <div className="panel stack">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Galerie ({entries.length})</h3>
          <label className="row small" style={{ gap: 6, fontWeight: 700 }}>
            <input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} />
            Masquer les noms (survoler pour voir)
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 14 }}>
          {entries.map((e) => (
            <Link
              key={e.student.id}
              to={`/prof/eleves/${e.student.id}`}
              className={'trombi-cell' + (hideNames ? ' hidden-name' : '')}
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              <Photo student={e.student} size="100%" />
              <div className="trombi-name" style={{ fontWeight: 800, marginTop: 6, lineHeight: 1.15 }}>
                {e.student.firstName}
                <div className="small muted" style={{ fontWeight: 600 }}>
                  {e.student.lastName} · {e.groups.join(', ')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
