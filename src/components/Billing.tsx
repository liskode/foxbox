// Soutien scolaire : tarifs, règlements, relevé mensuel et attestation annuelle.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type Billing, type PayMode, type Student, type TutorProfile } from '../lib/db';
import { billingId, buildLedger, CURRENCIES, money, hoursLabel, loadLedger, METHODS, monthLabel, monthOf, monthSummary, PAY_MODES, rateAt, type Ledger, type Line } from '../lib/billing';
import { durationLabel } from '../lib/tutoring';
import { frDate, today } from '../lib/dates';
import { placeLabel } from './Soutien';
import { toast } from './Toast';
import { Icon } from './Icon';

export function LineTag({ l }: { l: Line }) {
  if (l.rate === 0) return null; // soutien gratuit
  if (!l.amount) return <span className="tag plain">tarif à saisir</span>;
  return l.paid ? <span className="tag ok">réglée</span> : l.partly ? <span className="tag warn">en partie</span> : <span className="tag warn">à régler</span>;
}

export function BalanceTag({ ledger, billing }: { ledger: Ledger; billing?: Billing }) {
  const rate = rateAt(billing, today());
  if (ledger.free) return null;
  if (ledger.missingRate && !ledger.due && !ledger.paid) return <span className="tag plain">Tarif à saisir</span>;
  if (ledger.balance < 0) return <span className="tag warn">Reste à payer : {money(-ledger.balance, ledger.currency)}</span>;
  if (ledger.balance > 0)
    return (
      <span className="tag ok">
        Avance : {money(ledger.balance, ledger.currency)}
        {rate ? ` (≈ ${hoursLabel(ledger.balance / rate)} de cours)` : ''}
      </span>
    );
  return <span className="tag ok">À jour</span>;
}

// Panneau du professeur pour un élève : tarifs, mode, solde, règlements, séances
export function BillingPanel({ teacherId, student, showName }: { teacherId: string; student: Student; showName: boolean }) {
  const data = useLiveQuery(() => loadLedger(teacherId, student.id), [teacherId, student.id]);
  const teacher = useLiveQuery(() => db.teachers.get(teacherId), [teacherId]);
  const issuer: TutorProfile | undefined = teacher ? { ...(teacher.tutorProfile ?? {}), name: teacher.tutorProfile?.name || teacher.name } : undefined;
  // Les parents ne lisent pas la fiche du professeur : ses coordonnées sont recopiées avec le tarif
  useEffect(() => {
    if (data?.billing && issuer && JSON.stringify(data.billing.issuer ?? {}) !== JSON.stringify(issuer)) db.billing.update(data.billing.id, { issuer });
  }, [data?.billing, JSON.stringify(issuer)]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rateDraft, setRateDraft] = useState<{ from: string; hourly: string } | null>(null);
  const [pay, setPay] = useState<{ date: string; amount: string; method: string; label: string; hours: string } | null>(null);
  const [month, setMonth] = useState(monthOf(today()));
  if (!data) return null;
  const { ledger, billing } = data;
  const id = billingId(teacherId, student.id);
  const save = (patch: Partial<Billing>) =>
    db.billing.put({ id, teacherId, studentId: student.id, rates: [], mode: 'seance', ...(billing ?? {}), issuer, ...patch });
  const rate = rateAt(billing, today());
  const cur = ledger.currency;
  const months = [...new Set([monthOf(today()), ...ledger.lines.map((l) => monthOf(l.session.date))])].sort().reverse();
  const years = [...new Set([today().slice(0, 4), ...ledger.lines.map((l) => l.session.date.slice(0, 4))])].sort().reverse();

  async function addPayment() {
    if (!pay) return;
    const amount = Number(pay.amount.replace(',', '.'));
    if (!(amount > 0)) return alert('Montant invalide.');
    const p = { id: uid(), teacherId, studentId: student.id, date: pay.date, amount, method: pay.method, label: pay.label.trim() || undefined, createdAt: Date.now() };
    await db.payments.put(p);
    setPay(null);
    toast(`Règlement de ${money(amount, cur)} enregistré`, { undo: () => db.payments.delete(p.id) });
  }

  return (
    <div className="stack">
      {showName && <h2 style={{ margin: 0 }}>{student.firstName}</h2>}
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="panel stack" style={{ gap: 10 }}>
          <h3 className="panel-title">Tarif et façon de payer</h3>
          {!ledger.free && (
          <>
          <div className="seg" style={{ flexWrap: 'wrap' }}>
            {PAY_MODES.map((m) => (
              <button key={m.key} className={(billing?.mode ?? 'seance') === m.key ? 'on' : ''} title={m.hint} onClick={() => save({ mode: m.key as PayMode })}>
                {m.label}
              </button>
            ))}
          </div>
          <span className="small muted">{PAY_MODES.find((m) => m.key === (billing?.mode ?? 'seance'))!.hint}</span>
          <label className="row small" style={{ gap: 8 }}>
            Devise
            <select value={cur} onChange={(e) => save({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          </>
          )}
          {(billing?.rates ?? [])
            .slice()
            .sort((a, b) => b.from.localeCompare(a.from))
            .map((r) => (
              <div key={r.from} className="row" style={{ gap: 8 }}>
                <b>{money(r.hourly, cur)} / h</b>
                <span className="small muted">à partir du {frDate(r.from)}</span>
                <button
                  className="btn small ghost"
                  title="Retirer ce tarif"
                  onClick={() => {
                    save({ rates: billing!.rates.filter((x) => x.from !== r.from) });
                    toast('Tarif retiré', { undo: () => save({ rates: billing!.rates }) });
                  }}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          {rateDraft ? (
            <form
              className="row"
              style={{ gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                const hourly = Number(rateDraft.hourly.replace(',', '.'));
                if (!rateDraft.hourly.trim() || !(hourly >= 0)) return; // 0 : soutien gratuit
                save({ rates: [...(billing?.rates ?? []).filter((x) => x.from !== rateDraft.from), { from: rateDraft.from, hourly }] });
                setRateDraft(null);
              }}
            >
              <input autoFocus inputMode="decimal" placeholder={`${cur} / h`} value={rateDraft.hourly} onChange={(e) => setRateDraft({ ...rateDraft, hourly: e.target.value })} style={{ width: 90 }} />
              <span className="small">à partir du</span>
              <input type="date" value={rateDraft.from} onChange={(e) => setRateDraft({ ...rateDraft, from: e.target.value })} />
              <button className="btn small primary" type="submit">
                Enregistrer
              </button>
              <button className="btn small ghost" type="button" onClick={() => setRateDraft(null)}>
                Annuler
              </button>
            </form>
          ) : (
            <div>
              <button className="btn small" onClick={() => setRateDraft({ from: billing?.rates.length ? today() : ledger.lines[0]?.session.date ?? today(), hourly: '' })}>
                <Icon name="plus" size={15} /> {billing?.rates.length ? 'Nouveau tarif (date d’effet)' : 'Saisir le tarif horaire'}
              </button>
            </div>
          )}
          {ledger.missingRate && <span className="small" style={{ color: 'var(--bad)' }}>Certaines séances n'ont pas de tarif à leur date.</span>}
        </div>

        {ledger.free ? (
          <div className="panel calm small muted">Tarif à 0 : soutien gratuit, pas de règlement à suivre (rien n'apparaît non plus pour les parents).</div>
        ) : (
        <div className="panel stack" style={{ gap: 10 }}>
          <div className="spread">
            <h3 className="panel-title">Règlements</h3>
            <BalanceTag ledger={ledger} billing={billing} />
          </div>
          <span className="small muted">
            {hoursLabel(ledger.hours)} de cours · {money(ledger.due, cur)} dus · {money(ledger.paid, cur)} reçus
          </span>
          {pay ? (
            <div className="panel calm stack" style={{ gap: 8, padding: '10px 14px' }}>
              {billing?.mode === 'forfait' && rate && (
                <label className="row small" style={{ gap: 6 }}>
                  Forfait de
                  <input
                    inputMode="decimal"
                    value={pay.hours}
                    style={{ width: 60 }}
                    onChange={(e) => {
                      const h = Number(e.target.value.replace(',', '.'));
                      setPay({ ...pay, hours: e.target.value, amount: h > 0 ? String(Math.round(h * rate * 100) / 100) : pay.amount, label: h > 0 ? `Forfait ${e.target.value} h` : pay.label });
                    }}
                  />
                  heures à {money(rate, cur)}
                </label>
              )}
              <div className="row" style={{ gap: 8 }}>
                <input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
                <input inputMode="decimal" placeholder={`Montant (${cur})`} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} style={{ width: 110 }} />
                <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                  {METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <input placeholder="Libellé (facultatif) : séances d'octobre, forfait…" value={pay.label} onChange={(e) => setPay({ ...pay, label: e.target.value })} />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn small primary" onClick={addPayment}>
                  Enregistrer le règlement
                </button>
                <button className="btn small ghost" onClick={() => setPay(null)}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                className="btn small primary"
                onClick={() =>
                  setPay({ date: today(), amount: ledger.balance < 0 ? String(-ledger.balance) : '', method: 'Virement', label: billing?.mode === 'mois' ? `Séances de ${monthLabel(monthOf(today())).toLowerCase()}` : '', hours: '' })
                }
              >
                <Icon name="plus" size={15} /> Enregistrer un règlement
              </button>
            </div>
          )}
          {ledger.payments
            .slice()
            .reverse()
            .map((p) => (
              <div key={p.id} className="row small" style={{ gap: 8 }}>
                <span style={{ minWidth: 90 }}>{frDate(p.date)}</span>
                <b style={{ minWidth: 70 }}>{money(p.amount, cur)}</b>
                <span className="muted" style={{ flex: 1 }}>
                  {p.method}
                  {p.label ? ` · ${p.label}` : ''}
                </span>
                <button
                  className="btn small ghost"
                  title="Supprimer ce règlement"
                  onClick={async () => {
                    await db.payments.delete(p.id);
                    toast('Règlement supprimé', { undo: () => db.payments.put(p) });
                  }}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
        </div>
        )}
      </div>

      <div className="panel stack" style={{ gap: 8 }}>
        <div className="spread">
          <h3 className="panel-title">Séances</h3>
          {!ledger.free && (
          <div className="row" style={{ gap: 6 }}>
            <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mois du relevé">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <Link className="btn small" to={`/prof/soutien/releve/${student.id}?mois=${month}`}>
              <Icon name="print" size={15} /> Relevé du mois
            </Link>
            <select defaultValue={years[0]} id={`y-${student.id}`} aria-label="Année de l'attestation">
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <button
              className="btn small"
              onClick={() => {
                const y = (document.getElementById(`y-${student.id}`) as HTMLSelectElement).value;
                window.location.hash = `#/prof/soutien/attestation/${student.id}?annee=${y}`;
              }}
            >
              <Icon name="file" size={15} /> Attestation annuelle
            </button>
          </div>
          )}
        </div>
        <LinesTable lines={ledger.lines.slice().reverse()} currency={cur} tags={!ledger.free} money={!ledger.free} />
      </div>
    </div>
  );
}

export function LinesTable({ lines, tags = true, currency = 'EUR', money: showMoney = true }: { lines: Line[]; tags?: boolean; currency?: string; money?: boolean }) {
  if (!lines.length) return <span className="small muted">Aucune séance.</span>;
  return (
    <div className="scroll-x">
      <table className="small" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={{ padding: '4px 8px' }}>Date</th>
            <th style={{ padding: '4px 8px' }}>Durée</th>
            <th style={{ padding: '4px 8px' }}>Lieu</th>
            {showMoney && <th style={{ padding: '4px 8px', textAlign: 'right' }}>Tarif</th>}
            {showMoney && <th style={{ padding: '4px 8px', textAlign: 'right' }}>Montant</th>}
            {tags && <th />}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.session.id} style={{ borderTop: '1px solid var(--soft-line)' }}>
              <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{frDate(l.session.date)}</td>
              <td style={{ padding: '4px 8px' }}>{durationLabel(l.session.duration)}</td>
              <td style={{ padding: '4px 8px' }}>{placeLabel(l.session)}</td>
              {showMoney && <td style={{ padding: '4px 8px', textAlign: 'right' }}>{l.rate ? `${money(l.rate, currency)}/h` : '—'}</td>}
              {showMoney && <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 800 }}>{money(l.amount, currency)}</td>}
              {tags && (
                <td style={{ padding: '4px 8px' }}>
                  <LineTag l={l} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Données pour le relevé ou l'attestation : on retrouve le professeur par le tarif ou le groupe de soutien
export function useLedgerFor(studentId: string, teacherId?: string) {
  return useLiveQuery(async () => {
    let tid = teacherId;
    if (!tid) {
      const b = await db.billing.where('studentId').equals(studentId).first();
      const ms = await db.memberships.where('studentId').equals(studentId).toArray();
      const g = (await db.groups.bulkGet(ms.map((m) => m.groupId))).find((x) => x?.kind === 'soutien');
      tid = b?.teacherId ?? g?.teacherIds[0];
    }
    if (!tid) return null;
    const [student, teacher, data] = await Promise.all([db.students.get(studentId), db.teachers.get(tid), loadLedger(tid, studentId)]);
    return { student, teacher, teacherId: tid, ...data };
  }, [studentId, teacherId]);
}

// Relevé d'un mois (imprimable) : séances, montants, règlements reçus, solde
export function Statement({ studentId, month, teacherId }: { studentId: string; month: string; teacherId?: string }) {
  const d = useLedgerFor(studentId, teacherId);
  if (d === undefined) return null;
  if (!d) return <div className="notice">Relevé indisponible.</div>;
  const m = monthSummary(d.ledger, month);
  const cur = d.ledger.currency;
  const tp = d.teacher?.tutorProfile ?? d.billing?.issuer;
  const end = d.ledger.lines.filter((l) => monthOf(l.session.date) <= month).reduce((a, l) => a + l.amount, 0);
  const paidEnd = d.ledger.payments.filter((p) => monthOf(p.date) <= month).reduce((a, p) => a + p.amount, 0);
  const balance = Math.round((paidEnd - end) * 100) / 100;
  return (
    <div className="panel stack statement" style={{ gap: 12 }}>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div className="small">
          <b>{tp?.name || d.teacher?.name || d.billing?.issuer?.name}</b>
          {tp?.address && <div style={{ whiteSpace: 'pre-line' }}>{tp.address}</div>}
          {tp?.siret && <div>SIRET / déclaration : {tp.siret}</div>}
        </div>
        <div className="small" style={{ textAlign: 'right' }}>
          Élève : <b>{d.student ? `${d.student.firstName} ${d.student.lastName}` : ''}</b>
        </div>
      </div>
      <h2 style={{ margin: 0 }}>Relevé – {monthLabel(month)}</h2>
      <LinesTable lines={m.lines} tags={false} currency={cur} />
      <table className="small" style={{ borderCollapse: 'collapse', marginLeft: 'auto' }}>
        <tbody>
          {m.previous !== 0 && <Row k={m.previous > 0 ? 'Avance au début du mois' : 'Reste dû des mois précédents'} v={money(Math.abs(m.previous), cur)} />}
          <Row k={`Séances du mois (${hoursLabel(m.hours)})`} v={money(m.due, cur)} />
          <Row k="Règlements reçus ce mois-ci" v={money(m.received, cur)} />
          <Row k={balance < 0 ? 'Reste à payer' : balance > 0 ? 'Avance restante' : 'Solde'} v={money(Math.abs(balance), cur)} bold />
        </tbody>
      </table>
      {m.payments.length > 0 && (
        <div className="small">
          <b>Règlements reçus :</b>{' '}
          {m.payments.map((p) => `${frDate(p.date)} – ${money(p.amount, cur)} (${p.method}${p.label ? `, ${p.label}` : ''})`).join(' ; ')}
        </div>
      )}
    </div>
  );
}
const Row = ({ k, v, bold = false }: { k: string; v: string; bold?: boolean }) => (
  <tr>
    <td style={{ padding: '3px 12px 3px 0', fontWeight: bold ? 900 : 500 }}>{k}</td>
    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: bold ? 900 : 700 }}>{v}</td>
  </tr>
);

// Attestation annuelle : séances à domicile de l'année civile et sommes reçues pour elles
export function Attestation({ studentId, year }: { studentId: string; year: string }) {
  const d = useLedgerFor(studentId);
  if (d === undefined) return null;
  if (!d) return <div className="notice">Attestation indisponible.</div>;
  const tp = d.teacher?.tutorProfile ?? d.billing?.issuer;
  const home = d.ledger.lines.filter((l) => l.session.date.startsWith(year) && l.session.place !== 'en ligne');
  const paidHome = home.filter((l) => l.paid).reduce((a, l) => a + l.amount, 0);
  const hours = home.reduce((a, l) => a + l.hours, 0);
  const who = tp?.name || d.teacher?.name || '';
  return (
    <div className="panel stack statement" style={{ gap: 12 }}>
      <div className="small">
        <b>{who}</b>
        {tp?.address && <div style={{ whiteSpace: 'pre-line' }}>{tp.address}</div>}
        {tp?.siret && <div>SIRET / déclaration : {tp.siret}</div>}
      </div>
      <h2 style={{ margin: 0 }}>Attestation – année {year}</h2>
      <p style={{ margin: 0 }}>
        Je soussigné(e) {who} atteste avoir dispensé à{' '}
        <b>
          {d.student?.firstName} {d.student?.lastName}
        </b>{' '}
        des cours de soutien scolaire <b>à domicile</b> en {year} : {home.length} séance(s), {hoursLabel(hours)} au total, pour un montant réglé de{' '}
        <b>{money(paidHome, d.ledger.currency)}</b>.
      </p>
      <LinesTable lines={home} tags={false} currency={d.ledger.currency} />
      <p className="small muted" style={{ margin: 0 }}>
        Les séances en ligne ne figurent pas sur cette attestation. Fait le {frDate(today())}.
      </p>
      <div style={{ height: 60 }} />
      <div className="small" style={{ textAlign: 'right' }}>
        Signature
      </div>
    </div>
  );
}

// Récapitulatif global du professeur : par mois, tous élèves confondus
export function GlobalSummary({ teacherId }: { teacherId: string }) {
  const [year, setYear] = useState(today().slice(0, 4));
  const data = useLiveQuery(async () => {
    const groups = (await db.groups.toArray()).filter((g) => g.kind === 'soutien' && g.teacherIds.includes(teacherId));
    const sessions = await db.tutoringSessions.where('groupId').anyOf(groups.map((g) => g.id)).toArray();
    const ids = [...new Set((await db.memberships.where('groupId').anyOf(groups.map((g) => g.id)).toArray()).map((m) => m.studentId))];
    const students = (await db.students.bulkGet(ids)).filter(Boolean) as Student[];
    const rows = await Promise.all(
      students.map(async (s) => {
        const billing = await db.billing.get(billingId(teacherId, s.id));
        const payments = (await db.payments.where('studentId').equals(s.id).toArray()).filter((p) => p.teacherId === teacherId);
        return { student: s, ledger: buildLedger(s.id, sessions, billing, payments, groups) };
      }),
    );
    return rows.sort((a, b) => a.student.firstName.localeCompare(b.student.firstName));
  }, [teacherId]);
  if (!data) return null;
  const years = [...new Set([today().slice(0, 4), ...data.flatMap((r) => r.ledger.lines.map((l) => l.session.date.slice(0, 4)))])].sort().reverse();
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const inYear = (l: Line) => l.session.date.startsWith(year);
  const hours = (pred: (l: Line) => boolean) => data.reduce((a, r) => a + r.ledger.lines.filter(pred).reduce((b, l) => b + l.hours, 0), 0);
  // Un tableau par devise (les montants de devises différentes ne s'additionnent pas)
  const currencies = [...new Set(data.map((r) => r.ledger.currency))];
  const cell = { padding: '4px 10px', textAlign: 'right' as const };
  return (
    <div className="stack">
      <div className="row">
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Année">
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <span className="small muted">
          Domicile : {hoursLabel(hours((l) => inYear(l) && l.session.place !== 'en ligne'))} · en ligne : {hoursLabel(hours((l) => inYear(l) && l.session.place === 'en ligne'))}
        </span>
      </div>
      {currencies.map((cur) => {
        const rows = data.filter((r) => r.ledger.currency === cur);
        const sum = (f: (l: Line) => number, pred: (l: Line) => boolean) => rows.reduce((a, r) => a + r.ledger.lines.filter(pred).reduce((b, l) => b + f(l), 0), 0);
        const recv = (m: string) => rows.reduce((a, r) => a + r.ledger.payments.filter((p) => monthOf(p.date) === m).reduce((b, p) => b + p.amount, 0), 0);
        const shown = months.filter((m) => sum((l) => l.hours, (l) => monthOf(l.session.date) === m) || recv(m));
        return (
          <div key={cur} className="panel scroll-x">
            {currencies.length > 1 && <h3 className="panel-title">{CURRENCIES.find((c) => c.code === cur)?.label ?? cur}</h3>}
            <table className="small" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 10px' }}>Mois</th>
                  <th style={cell}>Heures</th>
                  <th style={cell}>Montant des séances</th>
                  <th style={cell}>Reçu</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m} style={{ borderTop: '1px solid var(--soft-line)' }}>
                    <td style={{ padding: '4px 10px' }}>{monthLabel(m)}</td>
                    <td style={cell}>{hoursLabel(sum((l) => l.hours, (l) => monthOf(l.session.date) === m))}</td>
                    <td style={cell}>{money(sum((l) => l.amount, (l) => monthOf(l.session.date) === m), cur)}</td>
                    <td style={cell}>{money(recv(m), cur)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--line)', fontWeight: 900 }}>
                  <td style={{ padding: '4px 10px' }}>Total {year}</td>
                  <td style={cell}>{hoursLabel(sum((l) => l.hours, inYear))}</td>
                  <td style={cell}>{money(sum((l) => l.amount, inYear), cur)}</td>
                  <td style={cell}>{money(shown.reduce((a, m) => a + recv(m), 0), cur)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
      <div className="panel stack" style={{ gap: 6 }}>
        <h3 className="panel-title">Par élève (depuis le début)</h3>
        {data.map((r) => (
          <div key={r.student.id} className="row small" style={{ gap: 10 }}>
            <b style={{ width: 140 }}>
              {r.student.firstName} {r.student.lastName}
            </b>
            <span style={{ width: 70 }}>{hoursLabel(r.ledger.hours)}</span>
            <span style={{ width: 90 }}>{money(r.ledger.due, r.ledger.currency)}</span>
            <BalanceTag ledger={r.ledger} />
          </div>
        ))}
        {!data.length && <span className="small muted">Aucun élève suivi.</span>}
      </div>
    </div>
  );
}
