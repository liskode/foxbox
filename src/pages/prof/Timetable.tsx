// Emploi du temps : import des PDF Pronote (semaine A et B), correction des cours, jours de présence,
// calendrier de l'année (semaines A / B, vacances, jours fériés).
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { uid } from '../../lib/db';
import { addDays, fromISO, today } from '../../lib/dates';
import {
  AUDIN_2026,
  DAYS,
  mergeWeeks,
  mondayOf,
  readPronotePdf,
  realternate,
  saveTimetable,
  type PronoteWeek,
  type Slot,
  type Timetable as TT,
  type WeekType,
} from '../../lib/timetable';
import { WeekGrid, groupOfSlot, useGroups, useTimetable } from '../../components/TimetableView';
import { isStaleVersionError } from '../../components/UpdateBanner';

const WEEK_COLORS = { A: '#f2c14e', B: '#7fb8e6' };

function ImportPanel({ tt, save }: { tt: TT; save: (t: TT) => Promise<void> }) {
  const groups = useGroups();
  const [parsed, setParsed] = useState<PronoteWeek[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setMsg('');
    setBusy(true);
    try {
      const out: PronoteWeek[] = [];
      for (const f of [...files]) out.push(await readPronotePdf(f, groups));
      setParsed(out);
    } catch (e) {
      setMsg(isStaleVersionError(e) ? 'FoxBox a été mis à jour : rechargez la page puis recommencez.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const slots = mergeWeeks(parsed);
    const school = parsed.find((p) => p.school)?.school ?? tt.school;
    // Calendrier vide : pré-rempli avec celui de l'établissement s'il est connu
    const prefill = !Object.keys(tt.weeks).length && /audin/i.test(school ?? '');
    await save({ ...tt, slots, school, ...(prefill ? AUDIN_2026 : {}) });
    setParsed([]);
    setMsg(`Emploi du temps enregistré : ${slots.length} cours.`);
  }

  const weeksRead = parsed.map((p) => p.week).filter(Boolean);
  const missing = parsed.length && !(weeksRead.includes('A') && weeksRead.includes('B'));

  return (
    <div className="panel stack">
      <h2 style={{ margin: 0 }}>Importer depuis Pronote</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Dans Pronote : Emploi du temps › imprimer en PDF une semaine A <b>et</b> une semaine B. Choisissez les deux fichiers ensemble. Les cours
        identiques les deux semaines sont marqués « toutes les semaines ».
      </p>
      <label className="btn primary" style={{ alignSelf: 'flex-start' }}>
        Choisir les PDF Pronote
        <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => onFiles(e.target.files)} disabled={busy} />
      </label>
      {busy && <div className="notice">Lecture…</div>}
      {msg && <div className="notice">{msg}</div>}
      {parsed.length > 0 && (
        <div className="stack">
          {parsed.map((p) => (
            <div key={p.fileName} className="small">
              <b>{p.week ? `Semaine ${p.week}` : 'Semaine sans A/B'}</b> — {p.slots.length} cours lus · {p.fileName}
            </div>
          ))}
          {missing ? (
            <div className="notice small">Il manque une semaine A ou B : seuls les cours lus seront enregistrés.</div>
          ) : null}
          <div className="row">
            <button className="btn primary" onClick={apply}>
              {tt.slots.length ? 'Remplacer mon emploi du temps' : 'Enregistrer'}
            </button>
            <button className="btn ghost" onClick={() => setParsed([])}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SlotEditor({ slot, onSave, onDelete, onClose }: { slot: Slot; onSave: (s: Slot) => void; onDelete: () => void; onClose: () => void }) {
  const groups = useGroups();
  const [s, setS] = useState(slot);
  const set = (p: Partial<Slot>) => setS({ ...s, ...p });
  return (
    <div className="panel stack" style={{ borderColor: 'var(--matiere)' }}>
      <div className="row" style={{ gap: 10 }}>
        <label className="field">
          Jour
          <select value={s.day} onChange={(e) => set({ day: +e.target.value })}>
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {DAYS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Début
          <input type="time" value={s.start} onChange={(e) => set({ start: e.target.value })} />
        </label>
        <label className="field">
          Fin
          <input type="time" value={s.end} onChange={(e) => set({ end: e.target.value })} />
        </label>
        <label className="field">
          Semaine
          <select value={s.week} onChange={(e) => set({ week: e.target.value as Slot['week'] })}>
            <option value="AB">Toutes</option>
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </label>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <label className="field">
          Classe / groupe (Pronote)
          <input value={s.label} onChange={(e) => set({ label: e.target.value })} style={{ width: 120 }} />
        </label>
        <label className="field">
          Classe FoxBox
          <select value={s.groupId ?? groupOfSlot(s, groups)?.id ?? ''} onChange={(e) => set({ groupId: e.target.value || undefined })}>
            <option value="">—</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 160 }}>
          Matière
          <input value={s.subject} onChange={(e) => set({ subject: e.target.value })} />
        </label>
        <label className="field">
          Salle
          <input value={s.room ?? ''} onChange={(e) => set({ room: e.target.value || undefined })} style={{ width: 90 }} />
        </label>
        <label className="field">
          AESH
          <input value={s.aide ?? ''} onChange={(e) => set({ aide: e.target.value || undefined })} style={{ width: 150 }} />
        </label>
      </div>
      <div className="spread">
        <button className="btn danger small" onClick={onDelete}>
          Supprimer ce cours
        </button>
        <div className="row">
          <button className="btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn primary" onClick={() => onSave(s)} disabled={s.start >= s.end}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// Année scolaire : du 1er septembre au début juillet
function schoolYearMondays(): string[] {
  const t = fromISO(today());
  const y = t.getMonth() >= 7 ? t.getFullYear() : t.getFullYear() - 1;
  const out = [];
  for (let m = mondayOf(`${y}-09-01`); m <= `${y + 1}-07-05`; m = addDays(m, 7)) out.push(m);
  return out;
}

function CalendarPanel({ tt, save }: { tt: TT; save: (t: TT) => Promise<void> }) {
  const [offDate, setOffDate] = useState('');
  const mondays = schoolYearMondays();
  const months = new Map<string, string[]>();
  for (const m of mondays) {
    // Une semaine est rangée dans le mois de son vendredi
    const key = addDays(m, 4).slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), m]);
  }

  async function cycle(m: string) {
    const cur = tt.weeks[m];
    const next: WeekType | undefined = cur === 'A' ? 'B' : cur === 'B' ? undefined : 'A';
    let weeks = { ...tt.weeks };
    if (next) weeks[m] = next;
    else delete weeks[m];
    if (next && Object.keys(weeks).some((k) => k > m) && confirm('Faire alterner aussi les semaines suivantes à partir de celle-ci ?'))
      weeks = realternate({ ...tt, weeks }, m);
    await save({ ...tt, weeks });
  }

  return (
    <div className="panel stack">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Calendrier de l'année</h2>
        <button
          className="btn small"
          onClick={() =>
            (!Object.keys(tt.weeks).length || confirm('Remplacer le calendrier actuel ?')) &&
            save({ ...tt, weeks: AUDIN_2026.weeks, off: AUDIN_2026.off })
          }
        >
          Pré-remplir : 2026-2027, Collège Audin (Vitry)
        </button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Cliquez sur une semaine pour la faire passer de <b>A</b> à <b>B</b> puis à <b>vacances</b>. Les jours fériés sont marqués à part.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {[...months.entries()].map(([ym, ms]) => (
          <div key={ym} className="stack" style={{ gap: 4 }}>
            <b className="small" style={{ textTransform: 'capitalize' }}>
              {fromISO(`${ym}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </b>
            {ms.map((m) => {
              const w = tt.weeks[m];
              const isNow = m === mondayOf(today());
              return (
                <button
                  key={m}
                  className="btn small"
                  onClick={() => cycle(m)}
                  style={{
                    justifyContent: 'space-between',
                    display: 'flex',
                    background: w ? WEEK_COLORS[w] : 'var(--paper)',
                    borderStyle: w ? 'solid' : 'dashed',
                    outline: isNow ? '3px solid var(--forgot)' : undefined,
                  }}
                  title={isNow ? 'Semaine en cours' : undefined}
                >
                  <span>
                    {fromISO(m).getDate()}–{fromISO(addDays(m, 4)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <b>{w ?? '🌴'}</b>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <b className="small">Jours fériés et jours sans cours</b>
        <div className="row" style={{ gap: 6 }}>
          {[...tt.off].sort().map((d) => (
            <span key={d} className="chip">
              {fromISO(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
              <button className="btn small ghost" style={{ padding: '0 6px' }} onClick={() => save({ ...tt, off: tt.off.filter((x) => x !== d) })}>
                ✕
              </button>
            </span>
          ))}
          <input type="date" value={offDate} onChange={(e) => setOffDate(e.target.value)} />
          <button
            className="btn small"
            disabled={!offDate || tt.off.includes(offDate)}
            onClick={async () => {
              await save({ ...tt, off: [...tt.off, offDate] });
              setOffDate('');
            }}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

export function Timetable() {
  const { session } = useAuth();
  const tt = useTimetable();
  const groups = useGroups();
  const [week, setWeek] = useState<WeekType>('A');
  const [editing, setEditing] = useState<Slot | null>(null);
  if (!tt) return null;
  const save = (t: TT) => saveTimetable(session!.id, t);
  const present = tt.presentDays ?? [];

  async function saveSlot(s: Slot) {
    const exists = tt!.slots.some((x) => x.id === s.id);
    await save({ ...tt!, slots: exists ? tt!.slots.map((x) => (x.id === s.id ? s : x)) : [...tt!.slots, s] });
    setEditing(null);
  }

  return (
    <div className="page stack">
      <h1 className="title" style={{ margin: 0 }}>
        Emploi du temps
      </h1>
      {tt.school && <span className="muted">{tt.school}</span>}

      <ImportPanel tt={tt} save={save} />

      {tt.slots.length > 0 && (
        <div className="panel stack">
          <div className="spread">
            <div className="row">
              {(['A', 'B'] as const).map((w) => (
                <button
                  key={w}
                  className="btn"
                  onClick={() => setWeek(w)}
                  style={{ background: week === w ? WEEK_COLORS[w] : 'var(--paper)', fontWeight: 900 }}
                >
                  Semaine {w}
                </button>
              ))}
            </div>
            <button
              className="btn small"
              onClick={() => setEditing({ id: uid(), week: 'AB', day: 1, start: '08:00', end: '08:55', subject: 'PHYSIQUE-CHIMIE', label: '' })}
            >
              + Ajouter un cours
            </button>
          </div>
          <span className="small muted">Cliquez sur un cours pour le corriger. Les jours où vous n'êtes pas présent sont grisés.</span>
          {editing && (
            <SlotEditor
              key={editing.id}
              slot={editing}
              onSave={saveSlot}
              onClose={() => setEditing(null)}
              onDelete={async () => {
                await save({ ...tt, slots: tt.slots.filter((x) => x.id !== editing.id) });
                setEditing(null);
              }}
            />
          )}
          <WeekGrid tt={tt} groups={groups} week={week} onSlot={setEditing} selected={editing?.id} />
          <div className="row" style={{ gap: 12 }}>
            <b className="small">Mes jours de présence :</b>
            {[1, 2, 3, 4, 5].map((d) => (
              <label key={d} className="row small" style={{ gap: 4 }}>
                <input
                  type="checkbox"
                  checked={!present.length || present.includes(d)}
                  onChange={(e) => {
                    const cur = present.length ? present : [1, 2, 3, 4, 5];
                    const next = e.target.checked ? [...cur, d].sort() : cur.filter((x) => x !== d);
                    save({ ...tt, presentDays: next.length === 5 ? [] : next });
                  }}
                />
                {DAYS[d]}
              </label>
            ))}
          </div>
        </div>
      )}

      <CalendarPanel tt={tt} save={save} />
    </div>
  );
}
