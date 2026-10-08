// Fiche élève (professeur) : ses évaluations, et le suivi des messages envoyés aux parents.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type Student } from '../lib/db';
import { useAuth } from '../lib/auth';
import { score } from '../lib/grading';
import { frDate, today } from '../lib/dates';

function useStudentEvals(studentId: string) {
  return useLiveQuery(async () => {
    const rs = await db.results.where('studentId').equals(studentId).toArray();
    const evs = await db.evaluations.bulkGet(rs.map((r) => r.evaluationId));
    return rs
      .map((r, i) => ({ r, ev: evs[i] }))
      .filter((x) => x.ev && !x.ev.template)
      .sort((a, b) => b.ev!.date.localeCompare(a.ev!.date));
  }, [studentId], []);
}

export function StudentEvaluations({ student }: { student: Student }) {
  const list = useStudentEvals(student.id);
  return (
    <div className="panel stack">
      <h3 style={{ margin: 0 }}>📋 Évaluations</h3>
      {!list.length && <span className="muted small">Aucune évaluation corrigée pour l'instant.</span>}
      <table className="list">
        <tbody>
          {list.map(({ r, ev }) => {
            const s = score(ev!, r);
            const failed = ev!.criteria.filter((c) => {
              const l = r.levels[c.id];
              return l !== null && l !== undefined && l <= 0.25;
            });
            return (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }} className="small muted">
                  {frDate(ev!.date)}
                </td>
                <td>
                  <Link to={`/prof/correction/${ev!.id}?onglet=copies&eleve=${student.id}`}>
                    <b>{ev!.name}</b>
                  </Link>
                  {failed.length > 0 && (
                    <div className="small muted" title={failed.map((c) => c.label).join('\n')}>
                      {failed.length} critère(s) raté(s)
                    </div>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 900 }}>{r.absent ? 'Absent' : s ? `${s.note20}/20` : '—'}</td>
                <td className="small muted">{r.appreciation}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ParentMessages({ student }: { student: Student }) {
  const { session } = useAuth();
  const evals = useStudentEvals(student.id);
  const messages = useLiveQuery(
    async () => (await db.parentMessages.where('studentId').equals(student.id).toArray()).sort((a, b) => b.date.localeCompare(a.date)),
    [student.id],
    [],
  );
  const [emails, setEmails] = useState((student.parentEmails ?? []).join(', '));
  const [evalId, setEvalId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [open, setOpen] = useState(false);

  function prefill(id: string) {
    setEvalId(id);
    const x = evals.find((e) => e.ev!.id === id);
    const s = x && score(x.ev!, x.r);
    setSubject(x ? `${student.firstName} ${student.lastName} – ${x.ev!.name}` : `${student.firstName} ${student.lastName} – Physique-Chimie`);
    setBody(
      x
        ? `Bonjour,\n\nJe me permets de vous contacter au sujet de l'évaluation « ${x.ev!.name} » du ${frDate(x.ev!.date)}${
            s ? `, pour laquelle ${student.firstName} a obtenu ${s.note20}/20` : ''
          }.\n\n\n\nCordialement,\n`
        : `Bonjour,\n\n\n\nCordialement,\n`,
    );
  }

  async function record(sent: boolean) {
    const to = emails.split(/[,;\s]+/).filter((x) => x.includes('@')).join(', ');
    await db.parentMessages.put({
      id: uid(),
      teacherId: session!.id,
      studentId: student.id,
      evaluationId: evalId || undefined,
      date: today(),
      to,
      subject,
      message: body,
    });
    if (sent) location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setOpen(false);
  }

  return (
    <div className="panel stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>✉️ Parents</h3>
        <button className="btn small primary" onClick={() => (prefill(evals[0]?.ev!.id ?? ''), setOpen(true))}>
          Écrire aux parents
        </button>
      </div>
      <label className="field">
        Adresse(s) e-mail des parents
        <input
          value={emails}
          placeholder="parent1@exemple.fr, parent2@exemple.fr"
          onChange={(e) => setEmails(e.target.value)}
          onBlur={() =>
            db.students.update(student.id, { parentEmails: emails.split(/[,;\s]+/).map((x) => x.trim()).filter((x) => x.includes('@')) })
          }
        />
      </label>
      {open && (
        <div className="notice stack" style={{ background: 'var(--paper)' }}>
          <label className="field">
            À propos de
            <select value={evalId} onChange={(e) => prefill(e.target.value)}>
              <option value="">— message général —</option>
              {evals.map(({ ev }) => (
                <option key={ev!.id} value={ev!.id}>
                  {ev!.name} ({frDate(ev!.date)})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Objet
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="field">
            Message
            <textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ fontFamily: 'var(--font)', minHeight: 160 }} />
          </label>
          <div className="row">
            <button className="btn primary" onClick={() => record(true)} disabled={!emails.includes('@')}>
              Ouvrir dans ma messagerie et garder une trace
            </button>
            <button className="btn ghost" onClick={() => record(false)}>
              Garder une trace seulement
            </button>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
          <span className="small muted">Le message part de votre messagerie habituelle (rien n'est envoyé par FoxBox). La trace reste visible par vous seul.</span>
        </div>
      )}
      {messages.length > 0 && (
        <table className="list">
          <tbody>
            {messages.map((m) => (
              <tr key={m.id}>
                <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                  {frDate(m.date)}
                </td>
                <td>
                  <b>{m.subject}</b>
                  <details className="small">
                    <summary className="muted">{m.to || 'sans destinataire'}</summary>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
                  </details>
                </td>
                <td>
                  <button className="btn small ghost" onClick={() => confirm('Supprimer cette trace ?') && db.parentMessages.delete(m.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
