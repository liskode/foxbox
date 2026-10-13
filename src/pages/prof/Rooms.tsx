// Salles : on coche les cases d'un quadrillage pour placer les places (des cases voisines forment une table).
import { ask } from '../../components/Dialog';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { loadRooms, newRoom, saveRooms, seatKey, timetableRooms, type Room } from '../../lib/rooms';

// Quadrillage de la salle. editable : cliquer ou glisser pour cocher / décocher des places.
export function RoomGrid({ room, onChange, cell = 34 }: { room: Room; onChange?: (seats: string[]) => void; cell?: number }) {
  const painting = useRef<null | boolean>(null);
  const [seats, setSeats] = useState(new Set(room.seats));
  useEffect(() => setSeats(new Set(room.seats)), [room.id, room.seats]);
  useEffect(() => {
    const up = () => {
      if (painting.current !== null && onChange) onChange([...seatsRef.current]);
      painting.current = null;
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  });
  const seatsRef = useRef(seats);
  seatsRef.current = seats;

  const paint = (k: string, on: boolean) => {
    const n = new Set(seatsRef.current);
    if (on) n.add(k);
    else n.delete(k);
    seatsRef.current = n;
    setSeats(n);
  };

  return (
    <div className="stack" style={{ gap: 6, alignItems: 'center', userSelect: 'none', touchAction: 'none' }}>
      <div style={{ width: Math.min(room.cols * cell, 600), maxWidth: '100%', textAlign: 'center', background: '#f6f4ef', color: 'var(--ink)', border: '1.5px solid #00000033', borderRadius: 6, fontWeight: 800, fontSize: '0.8rem', padding: 3 }}>
        Tableau
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${room.cols}, ${cell}px)`, gap: 0, border: '2px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--paper)' }}>
        {Array.from({ length: room.rows * room.cols }, (_, i) => {
          const r = Math.floor(i / room.cols);
          const c = i % room.cols;
          const k = seatKey(r, c);
          const on = seats.has(k);
          return (
            <div
              key={k}
              onPointerDown={(e) => {
                if (!onChange) return;
                e.preventDefault();
                painting.current = !on;
                paint(k, !on);
              }}
              onPointerEnter={() => painting.current !== null && paint(k, painting.current)}
              style={{
                width: cell,
                height: cell,
                border: '1px solid #e4e0d8',
                background: on ? 'var(--matiere)' : 'transparent',
                boxShadow: on ? 'inset 0 0 0 1px #00000033' : undefined,
                cursor: onChange ? 'pointer' : 'default',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function Rooms() {
  const { session } = useAuth();
  const rooms = useLiveQuery(() => loadRooms(session!.id), [session?.id], []);
  const known = useLiveQuery(() => timetableRooms(session!.id), [session?.id]);
  const [params, setParams] = useSearchParams();
  const sel = rooms.find((r) => r.id === params.get('salle')) ?? rooms[0];
  const save = (list: Room[]) => saveRooms(session!.id, list);
  const update = (p: Partial<Room>) => sel && save(rooms.map((r) => (r.id === sel.id ? { ...r, ...p } : r)));

  async function add(name?: string) {
    const n = name ?? (await ask('Nouvelle salle', { label: 'Nom', placeholder: 'SC102' }))?.trim();
    if (!n) return;
    const r = newRoom(n);
    await save([...rooms, r]);
    setParams({ salle: r.id }, { replace: true });
  }

  const missing = (known?.all ?? []).filter((n) => !rooms.some((r) => r.name === n));

  return (
    <div className="page stack">
      <div>
        <Link to="/prof/reglages" className="small muted">
          ← Réglages
        </Link>
        <h1 className="title" style={{ margin: 0 }}>
          Salles
        </h1>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {rooms.map((r) => (
          <button key={r.id} className={'btn' + (r.id === sel?.id ? ' primary' : ' ghost')} onClick={() => setParams({ salle: r.id }, { replace: true })}>
            {r.name} <span className="small muted">({r.seats.length} places)</span>
          </button>
        ))}
        {missing.map((n) => (
          <button key={n} className="btn small" onClick={() => add(n)} title="Salle de votre emploi du temps">
            + {n}
          </button>
        ))}
        <button className="btn small" onClick={() => add()}>
          + Nouvelle salle
        </button>
      </div>
      {sel ? (
        <div className="panel stack">
          <div className="spread">
            <div className="row">
              <label className="field">
                Nom
                <input value={sel.name} onChange={(e) => update({ name: e.target.value })} style={{ width: 120 }} />
              </label>
              <label className="field">
                Rangées
                <input type="number" min={2} max={20} value={sel.rows} onChange={(e) => update({ rows: Math.max(2, Math.min(20, +e.target.value || 2)) })} style={{ width: 70 }} />
              </label>
              <label className="field">
                Colonnes
                <input type="number" min={2} max={20} value={sel.cols} onChange={(e) => update({ cols: Math.max(2, Math.min(20, +e.target.value || 2)) })} style={{ width: 70 }} />
              </label>
              <b>{sel.seats.filter((k) => +k.split('-')[0] < sel.rows && +k.split('-')[1] < sel.cols).length} places</b>
            </div>
            <div className="row">
              <button className="btn small ghost" onClick={() => confirm('Effacer toutes les places ?') && update({ seats: [] })}>
                Tout effacer
              </button>
              <button
                className="btn small danger"
                onClick={() => confirm(`Supprimer la salle ${sel.name} ? Les plans de classe qui l'utilisent ne s'afficheront plus.`) && save(rooms.filter((r) => r.id !== sel.id))}
              >
                Supprimer la salle
              </button>
            </div>
          </div>
          <span className="small muted">
            Cliquez sur une case pour en faire une place ; glissez pour en cocher plusieurs d'un coup. Des places voisines forment une table, laissez une case vide
            entre deux tables. Le tableau est en haut.
          </span>
          <RoomGrid key={sel.id + sel.rows + sel.cols} room={sel} onChange={(seats) => update({ seats })} />
        </div>
      ) : (
        <div className="notice">Créez votre première salle{missing.length ? ' (les salles de votre emploi du temps sont proposées ci-dessus)' : ''}.</div>
      )}
    </div>
  );
}
