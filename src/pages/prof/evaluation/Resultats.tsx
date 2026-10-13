// Évaluation : résultats par classe (moyennes, compétences, critères, notes, export).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Evaluation, shortName } from '../../../lib/db';
import { FAIL_LEVEL, maxPoints, resetCardsForFailures, score, stats, dateFor, pronoteColumn } from '../../../lib/grading';
import { frDate } from '../../../lib/dates';
import { Avatar } from '../../../components/Avatar';

import { useResults, NoteBadge, CompetenceBadges, ClassCompetences } from './shared';

// ---------------------------------------------------------------- Résultats
export function ResultatsTab({ ev }: { ev: Evaluation }) {
  const { list, results } = useResults(ev);
  const groups = useLiveQuery(() => db.groups.bulkGet(ev.groupIds), [ev.groupIds.join()], []);
  const [msg, setMsg] = useState('');
  const linked = ev.criteria.some((c) => c.cardIds?.length);

  const byGroup = useMemo(
    () =>
      ev.groupIds.map((gid) => {
        const members = list.filter((x) => x.groupId === gid);
        const rs = members.map((m) => results.get(m.student.id));
        const notes = rs.map((r) => score(ev, r)?.note20).filter((x): x is number => x !== undefined);
        const absents = rs.filter((r) => r?.absent).length;
        const crit = ev.criteria.map((c) => {
          const ls = rs.map((r) => (r && !r.absent ? r.levels[c.id] : undefined)).filter((x): x is number => x !== null && x !== undefined);
          return ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : null;
        });
        return { gid, members, notes, absents, stat: stats(notes), crit };
      }),
    [ev, list, results],
  );

  function exportCsv() {
    const rows = [['Classe', 'Nom', 'Prénom', `Note /${maxPoints(ev)}`, 'Note /20', 'Absent', 'Appréciation']];
    for (const { student, groupId } of list) {
      const r = results.get(student.id);
      const s = score(ev, r);
      const g = groups.find((x) => x?.id === groupId);
      rows.push([
        g?.name ?? '',
        student.lastName,
        student.firstName,
        s ? String(s.note).replace('.', ',') : '',
        s ? String(s.note20).replace('.', ',') : '',
        r?.absent ? 'ABS' : '',
        (r?.appreciation ?? '').replace(/\s+/g, ' '),
      ]);
    }
    const csv = '﻿' + rows.map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${ev.name} - notes.csv`;
    a.click();
  }

  return (
    <div className="stack">
      <div className="row">
        <button className="btn" onClick={exportCsv}>
          ⬇ Exporter les notes (CSV pour Pronote / Excel)
        </button>
        {linked && (
          <button
            className="btn primary"
            onClick={async () => {
              if (
                !confirm(
                  'Remettre en boîte 1 (à revoir dès aujourd’hui) les flashcards liées aux critères ratés (≤ 25 %), pour chaque élève concerné ?',
                )
              )
                return;
              const r = await resetCardsForFailures(ev);
              setMsg(`${r.cards} flashcard(s) remise(s) en boîte 1 pour ${r.students} élève(s).`);
            }}
          >
            🃏 Remettre en boîte 1 les flashcards des critères ratés
          </button>
        )}
      </div>
      {msg && <div className="notice">{msg}</div>}
      {byGroup.map(({ gid, members, absents, stat, crit, notes }) => {
        const g = groups.find((x) => x?.id === gid);
        const bins = [0, 0, 0, 0, 0]; // 0-4, 4-8, 8-12, 12-16, 16-20
        notes.forEach((n) => bins[Math.min(4, Math.floor(n / 4))]++);
        const maxBin = Math.max(1, ...bins);
        return (
          <div key={gid} className="panel stack">
            <div className="spread">
              <h2 style={{ margin: 0 }}>
                <span style={{ background: g?.color, borderRadius: 10, padding: '0 8px' }}>{shortName(g?.name ?? '')}</span>{' '}
                <span className="small muted" style={{ fontWeight: 600 }}>
                  {frDate(dateFor(ev, gid))}
                </span>
              </h2>
              <button
                className="btn small"
                title="Notes sur 20, une par ligne, dans l'ordre alphabétique : cliquez dans la première case de la colonne Pronote puis collez (Cmd+V)"
                onClick={async () => {
                  await navigator.clipboard.writeText(pronoteColumn(ev, list, results, gid));
                  setMsg(
                    `Notes de ${shortName(g?.name ?? '')} copiées (${members.length} élèves, ordre alphabétique, sur 20, « Abs » pour les absents). Dans Pronote, cliquez sur la case du premier élève puis collez.`,
                  );
                }}
              >
                📋 Copier les notes pour Pronote
              </button>
            </div>
            <div className="grid3">
              <div>
                <div className="muted small">Moyenne (absents exclus)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{stat ? `${stat.mean}/20` : '—'}</div>
                {stat && (
                  <div className="small muted">
                    écart type {stat.sd} · min {stat.min} · max {stat.max} · {stat.n} copie(s) · {absents} absent(s) ·{' '}
                    {members.length - stat.n - absents} non corrigée(s)
                  </div>
                )}
              </div>
              <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 90 }}>
                {bins.map((b, i) => (
                  <div key={i} className="stack" style={{ alignItems: 'center', gap: 2, flex: 1 }}>
                    <span className="small">{b}</span>
                    <div
                      style={{
                        width: '100%',
                        height: (b / maxBin) * 60 + 2,
                        background: 'var(--turquoise)',
                        border: '2px solid var(--line)',
                        borderRadius: 4,
                      }}
                    />
                    <span className="small muted">
                      {i * 4}–{i * 4 + 4}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <ClassCompetences ev={ev} rs={members.map((m) => results.get(m.student.id))} />
            <details open>
              <summary style={{ fontWeight: 800, cursor: 'pointer' }}>Réussite par critère</summary>
              <table className="list" style={{ marginTop: 6 }}>
                <tbody>
                  {ev.criteria.map((c, i) => {
                    const v = crit[i];
                    return (
                      <tr key={c.id}>
                        <td style={{ width: '60%' }}>
                          {i + 1}. {c.label}
                          {c.cardIds?.length ? <span className="small muted"> · 🃏{c.cardIds.length}</span> : null}
                        </td>
                        <td>
                          {v === null ? (
                            <span className="muted small">—</span>
                          ) : (
                            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                              <div
                                style={{
                                  width: 140,
                                  height: 12,
                                  border: '2px solid var(--line)',
                                  borderRadius: 6,
                                  overflow: 'hidden',
                                  background: 'var(--paper)',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${v * 100}%`,
                                    height: '100%',
                                    background: v <= FAIL_LEVEL ? 'var(--forgot)' : v < 0.6 ? 'var(--hard)' : 'var(--easy)',
                                  }}
                                />
                              </div>
                              <b>{Math.round(v * 100)} %</b>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
            <details>
              <summary style={{ fontWeight: 800, cursor: 'pointer' }}>Notes des élèves</summary>
              <table className="list" style={{ marginTop: 6 }}>
                <tbody>
                  {members.map(({ student }) => {
                    const r = results.get(student.id);
                    return (
                      <tr key={student.id}>
                        <td>
                          <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                            <Avatar student={student} size={28} zoom />
                            <Link to={`/prof/correction/${ev.id}?onglet=copies&eleve=${student.id}`}>
                              {student.lastName} {student.firstName}
                            </Link>
                          </span>
                        </td>
                        <td>
                          <NoteBadge ev={ev} r={r} />
                        </td>
                        <td>
                          <CompetenceBadges ev={ev} r={r} small />
                        </td>
                        <td className="small muted" style={{ maxWidth: 360 }}>
                          {r?.appreciation}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          </div>
        );
      })}
    </div>
  );
}
