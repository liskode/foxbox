// Espace parents : suivi du soutien de chaque enfant (séances, travail, documents, note pour les parents, règlements)
// et fil de discussion avec le professeur. Pensé pour le téléphone.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, isTutoring, type Group, type Student, type TutoringSession, type Unit } from '../../lib/db';
import { buildLedger, money, monthLabel, monthOf, billingId } from '../../lib/billing';
import { frDate, today } from '../../lib/dates';
import { unitLabel } from '../../lib/units';
import { BalanceTag, LineTag } from '../../components/Billing';
import { FileList, LinkList, placeLabel, whenLabel, dayName } from '../../components/Soutien';
import { RichText } from '../../components/CardFace';
import { Chat } from '../../components/Chat';
import { Icon } from '../../components/Icon';

// Enfants du parent et leurs groupes de soutien
function useFamily() {
  const { session } = useAuth();
  return useLiveQuery(async () => {
    const parent = await db.parents.get(session!.id);
    if (!parent) return null;
    const children = ((await db.students.bulkGet(parent.studentIds)).filter(Boolean) as Student[]).sort((a, b) => a.firstName.localeCompare(b.firstName));
    const out = [];
    for (const c of children) {
      const ms = await db.memberships.where('studentId').equals(c.id).toArray();
      const groups = (await db.groups.bulkGet(ms.map((m) => m.groupId))).filter((g) => isTutoring(g) && !g!.archived) as Group[];
      out.push({ child: c, groups });
    }
    return { parent, children: out };
  }, [session?.id]);
}

function ChildPicker({ names, current, onChange }: { names: { id: string; name: string }[]; current: string; onChange: (id: string) => void }) {
  if (names.length < 2) return null;
  return (
    <div className="seg">
      {names.map((n) => (
        <button key={n.id} className={n.id === current ? 'on' : ''} onClick={() => onChange(n.id)}>
          {n.name}
        </button>
      ))}
    </div>
  );
}

export function ParentHome() {
  const fam = useFamily();
  const [sel, setSel] = useState<string | null>(null);
  if (fam === undefined) return null;
  if (!fam) return <div className="page muted">Compte introuvable.</div>;
  const cur = fam.children.find((c) => c.child.id === sel) ?? fam.children[0];
  return (
    <div className="page narrow stack">
      <div>
        <h1 className="title" style={{ margin: 0 }}>
          Espace parents
        </h1>
        <span className="small muted">
          {fam.parent.name}
          {fam.children.length ? ` · parent de ${fam.children.map((c) => c.child.firstName).join(', ')}` : ''}
        </span>
      </div>
      <ChildPicker names={fam.children.map((c) => ({ id: c.child.id, name: c.child.firstName }))} current={cur?.child.id ?? ''} onChange={setSel} />
      {!cur && <div className="notice">Aucun enfant rattaché à ce compte.</div>}
      {cur && !cur.groups.length && <div className="notice">Pas encore de suivi à afficher pour {cur.child.firstName}.</div>}
      {cur?.groups.map((g) => (
        <ChildTutoring key={g.id} child={cur.child} group={g} showName={cur.groups.length > 1} />
      ))}
    </div>
  );
}

function ChildTutoring({ child, group, showName }: { child: Student; group: Group; showName: boolean }) {
  const teacherId = group.teacherIds[0];
  const data = useLiveQuery(async () => {
    const sessions = (await db.tutoringSessions.where('groupId').equals(group.id).toArray()).filter((s) => s.studentIds.includes(child.id));
    const billing = await db.billing.get(billingId(teacherId, child.id));
    const payments = (await db.payments.where('studentId').equals(child.id).toArray()).filter((p) => p.teacherId === teacherId);
    const checks = await db.homeworkChecks.where('studentId').equals(child.id).toArray();
    const units = await db.units.toArray();
    return { sessions, billing, payments, checks, units, ledger: buildLedger(child.id, sessions, billing, payments, [group]) };
  }, [group.id, child.id, teacherId]);
  if (!data) return null;
  const sorted = data.sessions.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.start ?? '').localeCompare(a.start ?? ''));
  const last = sorted.find((s) => s.homework.trim());
  const lastDone = last && data.checks.some((c) => c.sessionId === last.id && c.done);
  const month = monthOf(today());
  return (
    <>
      {showName && <h2 style={{ margin: '8px 0 0' }}>{group.name}</h2>}
      {last && (
        <div className="panel stack" style={{ gap: 8 }}>
          <div className="spread">
            <h3 className="panel-title">
              <Icon name="clipboard" size={16} /> Travail pour la prochaine fois
            </h3>
            <span className={'tag ' + (lastDone ? 'ok' : 'plain')}>{lastDone ? 'fait' : 'pas encore coché'}</span>
          </div>
          <RichText text={last.homework} />
          <span className="small muted">
            Donné le {dayName(last.date)} {frDate(last.date)}
          </span>
        </div>
      )}

      {!data.ledger.free && (
      <div className="panel stack" style={{ gap: 8 }}>
        <div className="spread">
          <h3 className="panel-title">
            <Icon name="wallet" size={16} /> Règlements
          </h3>
          <BalanceTag ledger={data.ledger} billing={data.billing} />
        </div>
        {data.payments
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 5)
          .map((p) => (
            <div key={p.id} className="row small" style={{ gap: 8 }}>
              <span style={{ width: 90 }}>{frDate(p.date)}</span>
              <b>{money(p.amount, data.ledger.currency)}</b>
              <span className="muted">
                {p.method}
                {p.label ? ` · ${p.label}` : ''}
              </span>
            </div>
          ))}
        <div>
          <Link className="btn small" to={`/parent/releve/${child.id}?mois=${month}`}>
            <Icon name="print" size={15} /> Relevé de {monthLabel(month).toLowerCase()}
          </Link>
        </div>
      </div>
      )}

      <h2 style={{ margin: '8px 0 0' }}>Séances de {child.firstName}</h2>
      {!sorted.length && <div className="notice">Aucune séance pour l'instant.</div>}
      {sorted.map((s, i) => (
        <details key={s.id} className="panel" open={i === 0}>
          <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
            {whenLabel(s)} <span className="tag plain">{placeLabel(s)}</span>{' '}
            {(() => {
              const l = data.ledger.lines.find((x) => x.session.id === s.id);
              return l ? <LineTag l={l} /> : null;
            })()}
          </summary>
          <div style={{ marginTop: 10 }}>
            <ParentSession s={s} child={child} units={data.units} done={data.checks.some((c) => c.sessionId === s.id && c.done)} />
          </div>
        </details>
      ))}
    </>
  );
}

function ParentSession({ s, child, units, done }: { s: TutoringSession; child: Student; units: Unit[]; done: boolean }) {
  const note = useLiveQuery(() => db.sessionNotes.get(`${s.id}|${child.id}|parents`), [s.id, child.id]);
  const files = useLiveQuery(() => db.tutoringFiles.where('sessionId').equals(s.id).sortBy('createdAt'), [s.id], []);
  const points = s.unitIds.map((id) => units.find((u) => u.id === id)).filter(Boolean) as Unit[];
  return (
    <div className="stack" style={{ gap: 10 }}>
      {points.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          {points.map((u) => (
            <span key={u.id} className="tag plain" style={{ whiteSpace: 'normal' }}>
              {unitLabel(u)}
            </span>
          ))}
        </div>
      )}
      {s.done.trim() && <RichText text={s.done} />}
      {note?.text.trim() && (
        <div className="panel note stack" style={{ gap: 4, padding: '10px 14px' }}>
          <b className="small">Pour vous</b>
          <RichText text={note.text} />
        </div>
      )}
      {s.homework.trim() && (
        <div className="stack" style={{ gap: 4 }}>
          <b className="small">
            Travail donné <span className={'tag ' + (done ? 'ok' : 'plain')}>{done ? 'fait' : 'pas encore coché'}</span>
          </b>
          <RichText text={s.homework} />
        </div>
      )}
      <FileList files={files} />
      <LinkList links={s.links} />
    </div>
  );
}

export function ParentMessages() {
  const fam = useFamily();
  const [sel, setSel] = useState<string | null>(null);
  if (!fam) return null;
  const cur = fam.children.find((c) => c.child.id === sel) ?? fam.children[0];
  const teachers = [...new Set(cur?.groups.map((g) => g.teacherIds[0]) ?? [])];
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>
        Messages
      </h1>
      <ChildPicker names={fam.children.map((c) => ({ id: c.child.id, name: c.child.firstName }))} current={cur?.child.id ?? ''} onChange={setSel} />
      {cur && !teachers.length && <div className="notice">Pas encore de suivi pour {cur.child.firstName}.</div>}
      {cur &&
        teachers.map((t) => (
          <Chat
            key={t}
            teacherId={t}
            studentId={cur.child.id}
            thread="parents"
            me={{ id: fam.parent.id, name: fam.parent.name }}
            hint={`Au sujet de ${cur.child.firstName}. ${cur.child.firstName} ne lit pas ces messages.`}
          />
        ))}
      <label className="row small" style={{ gap: 8, fontWeight: 700 }}>
        <input type="checkbox" checked={fam.parent.notifyEmail !== false} onChange={(e) => db.parents.update(fam.parent.id, { notifyEmail: e.target.checked })} />
        Être prévenu(e) par e-mail des nouveaux messages
        {fam.parent.login.includes('@') ? '' : ' (il faut un identifiant e-mail : demandez-le au professeur)'}
      </label>
    </div>
  );
}
