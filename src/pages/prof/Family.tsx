// Famille d'un élève : coordonnées des parents (privées), notes, et suivi des échanges (téléphone, mail, entretien).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, isTutoring, type FamilyContact, type Parent, type ParentMessage, shortName } from '../../lib/db';
import { createParentAccess } from '../../lib/parents';
import { showInfo } from '../../components/Dialog';
import { useAuth } from '../../lib/auth';
import { score } from '../../lib/grading';
import { frDate, today } from '../../lib/dates';
import { Avatar } from '../../components/Avatar';
import { FlagBadges, useNote } from '../../components/StudentNote';
import { useStudentEvals } from '../../components/StudentEvaluations';
import { Icon } from '../../components/Icon';

const KINDS: { key: NonNullable<ParentMessage['kind']>; label: string; icon: string }[] = [
  { key: 'tel', label: 'Téléphone', icon: 'phone' },
  { key: 'mail', label: 'Mail', icon: 'mail' },
  { key: 'entretien', label: 'Entretien', icon: 'handshake' },
];
const kindOf = (m: ParentMessage) => KINDS.find((k) => k.key === (m.kind ?? 'mail'))!;

export function Family() {
  const { id } = useParams();
  const { session } = useAuth();
  const student = useLiveQuery(() => db.students.get(id!), [id]);
  const groups = useLiveQuery(async () => {
    const ms = await db.memberships.where('studentId').equals(id!).toArray();
    return (await db.groups.bulkGet(ms.map((m) => m.groupId))).filter((g) => g && !g.archived);
  }, [id], []);
  const { family, flags, setFamily } = useNote(id!);
  const evals = useStudentEvals(id!);
  // Accès parents : proposés pour les élèves suivis en soutien (l'espace parents ne montre encore que le soutien)
  const tutored = groups.some((g) => isTutoring(g));
  const parents = useLiveQuery(() => db.parents.where('studentIds').equals(id!).toArray(), [id], []);
  const log = useLiveQuery(
    async () => (await db.parentMessages.where('studentId').equals(id!).toArray()).sort((a, b) => b.date.localeCompare(a.date)),
    [id],
    [],
  );

  // Coordonnées : brouillon local, enregistré en quittant un champ. Reprise des anciennes adresses saisies sur la fiche.
  const [contacts, setContacts] = useState<FamilyContact[]>([]);
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (family) {
      setContacts(family.contacts);
      setNotes(family.notes ?? '');
    } else if (student?.parentEmails?.length) setContacts(student.parentEmails.map((email, i) => ({ id: uid(), name: `Parent ${i + 1}`, email })));
  }, [family, student?.parentEmails]);
  const persist = async (cs = contacts, n = notes) => {
    await setFamily({ contacts: cs.filter((c) => c.name.trim() || c.person?.trim() || c.email?.trim() || c.phone?.trim()), notes: n });
    // Les adresses ne restent plus dans le compte de l'élève (lisible par lui)
    if (student?.parentEmails?.length) await db.students.update(student.id, { parentEmails: [] });
  };
  const setContact = (cid: string, p: Partial<FamilyContact>) => setContacts(contacts.map((c) => (c.id === cid ? { ...c, ...p } : c)));

  // Nouvelle entrée du suivi
  const blank = { date: today(), kind: 'tel' as NonNullable<ParentMessage['kind']>, to: '', subject: '', message: '', evaluationId: '' };
  const [entry, setEntry] = useState<typeof blank | null>(null);
  const emails = contacts.map((c) => c.email?.trim()).filter((e): e is string => !!e && e.includes('@'));

  function prefillMail(evalId: string) {
    const x = evals.find((e) => e.ev!.id === evalId);
    const s = x && score(x.ev!, x.r);
    setEntry({
      ...blank,
      kind: 'mail',
      evaluationId: evalId,
      to: emails.join(', '),
      subject: x ? `${student!.firstName} ${student!.lastName} – ${x.ev!.name}` : `${student!.firstName} ${student!.lastName} – Physique-Chimie`,
      message: x
        ? `Bonjour,\n\nJe me permets de vous contacter au sujet de l'évaluation « ${x.ev!.name} » du ${frDate(x.date)}${s ? `, pour laquelle ${student!.firstName} a obtenu ${s.note20}/20` : ''}.\n\n\n\nCordialement,\n`
        : `Bonjour,\n\n\n\nCordialement,\n`,
    });
  }

  async function save(openMail: boolean) {
    if (!entry) return;
    // Mail ouvert pendant le clic (sinon Safari bloque)
    if (openMail) {
      const to = entry.to.split(/[,;\s]+/).filter((x) => x.includes('@'));
      location.href = `mailto:${to.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(entry.subject)}&body=${encodeURIComponent(entry.message)}`;
    }
    await db.parentMessages.put({
      id: uid(),
      teacherId: session!.id,
      studentId: id!,
      evaluationId: entry.evaluationId || undefined,
      date: entry.date,
      kind: entry.kind,
      to: entry.to,
      subject: entry.subject,
      message: entry.message,
    });
    setEntry(null);
  }

  if (!student) return null;
  return (
    <div className="page stack">
      <div className="row" style={{ gap: 14 }}>
        <Avatar student={student} size={64} zoom />
        <div>
          <Link to={`/prof/eleves/${student.id}`} className="small muted">
            ← Fiche de {student.firstName}
          </Link>
          <h1 className="title" style={{ margin: 0 }}>
            <Icon name="family" size={22} /> Famille de {student.firstName} {student.lastName}
          </h1>
          <div className="row" style={{ gap: 6 }}>
            {groups.map((g) => (
              <span key={g!.id} className="chip cchip" style={{ background: g!.color }}>
                {shortName(g!.name)}
              </span>
            ))}
            <FlagBadges flags={flags} />
          </div>
        </div>
      </div>

      <div className="panel stack">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Coordonnées</h2>
          <button className="btn small" onClick={() => setContacts([...contacts, { id: uid(), name: '', person: '', email: '', phone: '' }])}>
            + Ajouter un contact
          </button>
        </div>
        {contacts.map((c) => (
          <div key={c.id} className="row" style={{ gap: 8 }}>
            <input value={c.name} aria-label="Lien avec l'élève" placeholder="Mère, Père…" onChange={(e) => setContact(c.id, { name: e.target.value })} onBlur={() => persist()} style={{ width: 130 }} />
            <input value={c.person ?? ''} aria-label="Prénom et nom" placeholder="Prénom et nom" onChange={(e) => setContact(c.id, { person: e.target.value })} onBlur={() => persist()} style={{ width: 200 }} />
            <input type="email" value={c.email ?? ''} placeholder="e-mail" onChange={(e) => setContact(c.id, { email: e.target.value })} onBlur={() => persist()} style={{ flex: 1, minWidth: 200 }} />
            <input type="tel" value={c.phone ?? ''} placeholder="téléphone" onChange={(e) => setContact(c.id, { phone: e.target.value })} onBlur={() => persist()} style={{ width: 150 }} />
            {tutored && <ParentAccessButton studentId={id!} contact={c} parents={parents} onBeforeCreate={() => persist()} />}
            {c.phone && (
              <a className="btn small ghost" href={`tel:${c.phone.replace(/\s/g, '')}`} title="Appeler">
                <Icon name="phone" size={16} />
              </a>
            )}
            <button
              className="btn small ghost"
              title="Retirer ce contact"
              onClick={() => {
                if (!confirm(`Retirer le contact « ${c.person || c.name || c.email || c.phone} » ?`)) return;
                const cs = contacts.filter((x) => x.id !== c.id);
                setContacts(cs);
                persist(cs);
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {!contacts.length && <span className="muted small">Aucun contact. Ajoutez les parents (e-mail et téléphone).</span>}
        <label className="field">
          Notes sur la famille
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => persist()}
            placeholder="Situation familiale, préférences de contact, langue, horaires…"
            style={{ fontFamily: 'var(--font)', minHeight: 80 }}
          />
        </label>
        <span className="small muted"><Icon name="lock" size={13} /> Visible par vous seul · enregistré en quittant un champ</span>
      </div>

      <div className="panel stack">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Suivi des échanges</h2>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn small primary" onClick={() => setEntry({ ...blank })}>
              + Nouvelle entrée
            </button>
            <button className="btn small" disabled={!emails.length} title={emails.length ? '' : 'Ajoutez d’abord une adresse e-mail'} onClick={() => prefillMail(evals[0]?.ev!.id ?? '')}>
              <Icon name="mail" size={16} /> Écrire un mail
            </button>
          </div>
        </div>
        {entry && (
          <div className="notice stack" style={{ background: 'var(--paper)' }}>
            <div className="row" style={{ gap: 8 }}>
              <label className="field">
                Date
                <input type="date" value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} />
              </label>
              <label className="field">
                Type
                <select value={entry.kind} onChange={(e) => setEntry({ ...entry, kind: e.target.value as typeof entry.kind })}>
                  {KINDS.map((k) => (
                    <option key={k.key} value={k.key}>
                      <Icon name={k.icon} size={16} /> {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ flex: 1, minWidth: 180 }}>
                {entry.kind === 'mail' ? 'Destinataire(s)' : 'Avec'}
                <input value={entry.to} list="family-contacts" onChange={(e) => setEntry({ ...entry, to: e.target.value })} placeholder="Mère, Père…" />
                <datalist id="family-contacts">
                  {contacts.map((c) => (
                    <option key={c.id} value={entry.kind === 'mail' ? c.email ?? '' : [c.name, c.person].filter(Boolean).join(' – ')} />
                  ))}
                </datalist>
              </label>
              {entry.kind === 'mail' && evals.length > 0 && (
                <label className="field">
                  À propos de
                  <select value={entry.evaluationId} onChange={(e) => prefillMail(e.target.value)}>
                    <option value="">— message général —</option>
                    {evals.map(({ ev, date }) => (
                      <option key={ev!.id} value={ev!.id}>
                        {ev!.name} ({frDate(date)})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <label className="field">
              Objet
              <input value={entry.subject} onChange={(e) => setEntry({ ...entry, subject: e.target.value })} placeholder="Comportement, résultats, devoirs…" />
            </label>
            <label className="field">
              {entry.kind === 'mail' ? 'Message' : 'Compte rendu'}
              <textarea value={entry.message} onChange={(e) => setEntry({ ...entry, message: e.target.value })} style={{ fontFamily: 'var(--font)', minHeight: 120 }} />
            </label>
            <div className="row">
              {entry.kind === 'mail' && (
                <button className="btn primary" disabled={!entry.to.includes('@')} onClick={() => save(true)}>
                  Ouvrir dans ma messagerie et noter
                </button>
              )}
              <button className={'btn' + (entry.kind === 'mail' ? ' ghost' : ' primary')} onClick={() => save(false)}>
                Enregistrer l'entrée
              </button>
              <button className="btn ghost" onClick={() => setEntry(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}
        {log.map((m) => {
          const k = kindOf(m);
          return (
            <div key={m.id} className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'nowrap', borderTop: '1px solid var(--muted-line)', paddingTop: 8 }}>
              <span className="small muted" style={{ whiteSpace: 'nowrap', minWidth: 90 }}>
                {frDate(m.date)}
              </span>
              <span title={k.label}><Icon name={k.icon} size={16} /></span>
              <div style={{ flex: 1 }}>
                <b>{m.subject || k.label}</b> {m.to && <span className="small muted">· {m.to}</span>}
                {m.message && (
                  <details className="small">
                    <summary className="muted">{k.key === 'mail' ? 'message' : 'compte rendu'}</summary>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
                  </details>
                )}
              </div>
              <button className="btn small ghost" onClick={() => confirm('Supprimer cette entrée ?') && db.parentMessages.delete(m.id)}>
                ✕
              </button>
            </div>
          );
        })}
        {!log.length && !entry && <span className="muted small">Aucun échange noté pour l'instant.</span>}
      </div>
    </div>
  );
}

// Accès parent d'un contact : création (identifiant = son e-mail s'il est saisi), ou rappel de l'identifiant
function ParentAccessButton({ studentId, contact, parents, onBeforeCreate }: { studentId: string; contact: FamilyContact; parents: Parent[]; onBeforeCreate: () => Promise<void> }) {
  const p = parents.find((x) => x.contactIds?.includes(contact.id) || (contact.email && x.login === contact.email.trim().toLowerCase()));
  if (p)
    return (
      <button className="btn small ghost" title="Accès parent créé" onClick={() => showInfo('Accès parent', `${p.name}\nIdentifiant : ${p.login}\nMot de passe : ${p.password}`)}>
        <Icon name="key" size={15} /> Accès
      </button>
    );
  return (
    <button
      className="btn small"
      title="Créer un compte pour ce parent : il suit les séances, les règlements et peut vous écrire"
      onClick={async () => {
        if (!contact.name.trim() && !contact.person?.trim()) return alert('Indiquez d’abord le lien (Mère, Père…) ou le nom du parent.');
        await onBeforeCreate();
        try {
          const r = await createParentAccess(studentId, contact);
          await showInfo(
            'Accès parent créé',
            r.reused
              ? `Ce parent avait déjà un accès (${r.login}) : il voit maintenant aussi cet enfant.`
              : `Identifiant : ${r.login}\nMot de passe : ${r.password}\n\nÀ transmettre au parent. Connexion sur foxbox.physifox.fr.`,
          );
        } catch (e) {
          alert('Erreur : ' + (e as Error).message);
        }
      }}
    >
      <Icon name="plus" size={15} /> Créer l'accès
    </button>
  );
}
