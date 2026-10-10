// Case « classe × séance » : date prévisionnelle (grise) ou date où la séance a été faite (noire).
// Un clic ouvre un petit choix : faite lors de l'un des derniers cours, à une autre date, ou décocher.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { evalDone } from '../lib/grading';
import type { Group } from '../lib/db';
import { today } from '../lib/dates';
import { dm, markDone, recentCourseDays, unmarkDone } from '../lib/forecast';
import type { Timetable } from '../lib/timetable';
import { fromISO } from '../lib/dates';

const dayLabel = (iso: string) => fromISO(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export function DoneCell({
  g,
  unitId,
  done,
  planned,
  viaSeq,
  tt,
  groups,
  showName = true,
  isEval = false,
}: {
  g: Group;
  unitId: string;
  done?: string;
  planned?: string;
  viaSeq?: boolean; // faite avec toute la séquence (ancienne publication)
  tt: Timetable;
  groups: Group[];
  showName?: boolean;
  isEval?: boolean; // séance d'évaluation : cocher ouvre la saisie des copies de la classe
}) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState('');
  // Derniers cours de la classe, dans l'ordre chronologique (le plus récent en bas)
  const recent = open ? recentCourseDays(tt, g, groups).reverse() : [];

  async function pick(date: string) {
    await markDone(g.id, unitId, date);
    setOpen(false);
    if (isEval) {
      const ev = await evalDone(unitId, g.id, date);
      if (ev) nav(`/prof/correction/${ev.id}?onglet=copies&classe=${g.id}`);
    }
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="chip"
        onClick={() => !viaSeq && setOpen(!open)}
        title={done ? `Faite le ${dayLabel(done)}` : planned ? `Prévue le ${dayLabel(planned)}` : 'Pas de date prévue (au-delà de la fin de l’année ?)'}
        style={{
          cursor: viaSeq ? 'default' : 'pointer',
          background: done ? g.color ?? 'var(--paper)' : 'var(--paper)',
          border: `2px ${done ? 'solid' : 'dashed'} ${done ? 'var(--ink)' : 'var(--muted-line)'}`,
          color: done ? 'var(--ink)' : '#9a968d',
          fontWeight: done ? 800 : 600,
          whiteSpace: 'nowrap',
          fontSize: '0.8rem',
        }}
      >
        {showName && <span style={{ color: 'var(--ink)', fontWeight: 800 }}>{g.name.replace(/_.*/, '')} </span>}
        {done ? `✓ ${dm(done)}` : planned ? dm(planned) : '—'}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div className="panel stack" style={{ position: 'absolute', zIndex: 41, top: '110%', left: 0, minWidth: 220, gap: 6, padding: 12 }}>
            <b className="small">{g.name} — faite le :</b>
            {recent.map((d) => (
              <button key={d} className={'btn small' + (d === done ? ' primary' : ' ghost')} style={{ justifyContent: 'flex-start' }} onClick={() => pick(d)}>
                {dayLabel(d)}
                {d === today() ? " (aujourd'hui)" : d === recent[recent.length - 1] ? ' (dernier cours)' : ''}
              </button>
            ))}
            {!recent.length && (
              <button className="btn small ghost" onClick={() => pick(today())}>
                Aujourd'hui
              </button>
            )}
            <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              <input type="date" value={other} onChange={(e) => setOther(e.target.value)} style={{ fontSize: '0.8rem' }} />
              <button className="btn small" disabled={!other} onClick={() => pick(other)}>
                OK
              </button>
            </div>
            {done && (
              <button className="btn small danger" onClick={() => unmarkDone(g.id, unitId).then(() => setOpen(false))}>
                Décocher (pas encore faite)
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}
