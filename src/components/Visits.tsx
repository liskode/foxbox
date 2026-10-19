// Fiche élève : journal des connexions de l'élève et de ses parents (date, heure, durée).
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Student } from '../lib/db';
import { frDate } from '../lib/dates';
import { dayName } from './Soutien';
import { Icon } from './Icon';

const hm = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')} h ${String(d.getMinutes()).padStart(2, '0')}`;
};
const iso = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dur = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 1 ? 'moins d’1 min' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};

export function StudentVisits({ student }: { student: Student }) {
  const visits = useLiveQuery(async () => (await db.visits.where('studentIds').equals(student.id).toArray()).sort((a, b) => b.start - a.start), [student.id], []);
  const [all, setAll] = useState(false);
  const last = (role: 'eleve' | 'parent') => visits.find((v) => v.role === role);
  const shown = all ? visits : visits.slice(0, 15);
  const cell = { padding: '4px 10px' };
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <h3 className="panel-title">
        <Icon name="calendar" size={16} /> Connexions
      </h3>
      <span className="small muted">
        Dernière connexion de {student.firstName} :{' '}
        {last('eleve') ? `${dayName(iso(last('eleve')!.start))} ${frDate(iso(last('eleve')!.start))} à ${hm(last('eleve')!.start)}` : 'jamais (depuis la mise en place du journal)'}
        {last('parent') ? ` · des parents : ${dayName(iso(last('parent')!.start))} ${frDate(iso(last('parent')!.start))} à ${hm(last('parent')!.start)}` : ''}
      </span>
      {visits.length > 0 && (
        <div className="scroll-x">
          <table className="small" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={cell}>Date</th>
                <th style={cell}>Heure</th>
                <th style={cell}>Durée</th>
                <th style={cell}>Qui</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((v) => (
                <tr key={v.id} style={{ borderTop: '1px solid var(--soft-line)' }}>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    {dayName(iso(v.start))} {frDate(iso(v.start))}
                  </td>
                  <td style={cell}>{hm(v.start)}</td>
                  <td style={cell}>{dur(v.last - v.start)}</td>
                  <td style={cell}>
                    <span className={'tag ' + (v.role === 'eleve' ? 'plain' : 'warn')}>{v.role === 'eleve' ? 'Élève' : 'Parent'}</span> {v.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {visits.length > 15 && (
        <div>
          <button className="btn small ghost" onClick={() => setAll(!all)}>
            {all ? 'Afficher moins' : `Tout afficher (${visits.length})`}
          </button>
        </div>
      )}
      <span className="small muted">Une connexion dure tant que FoxBox reste ouvert à l'écran ; après 30 min d'absence, une nouvelle commence.</span>
    </div>
  );
}
