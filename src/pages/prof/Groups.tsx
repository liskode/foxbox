import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, SUBJECTS, CLASS_COLORS, type Group, type Rule } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { groupOverview } from '../../lib/stats';
import { parseCsv, importStudents, resetPassword, deleteStudent, deleteGroup, type ParsedRow } from '../../lib/students';
import { frDate } from '../../lib/dates';
import { CardFace } from '../../components/CardFace';
import { CardDetail } from '../../components/CardDetail';
import { Heatmap, Pct, RateBar } from '../../components/widgets';
import { heatmapCounts } from '../../lib/stats';
import { DEFAULT_GOAL } from '../../lib/leitner';
import { Avatar, StudentName } from '../../components/Avatar';
import { importPhotos } from '../../lib/photos';
import { TrombiImport } from '../../components/TrombiImport';

function schoolYear() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

export function Groups() {
  const { session } = useAuth();
  const nav = useNavigate();
  const groups = useLiveQuery(() => db.groups.toArray(), [], []);
  const counts = useLiveQuery(async () => {
    const ms = await db.memberships.toArray();
    const m = new Map<string, number>();
    ms.forEach((x) => m.set(x.groupId, (m.get(x.groupId) ?? 0) + 1));
    return m;
  }, [], new Map<string, number>());
  const [name, setName] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);

  async function create() {
    if (!name.trim()) return;
    // Couleur par défaut : la première de la palette pas encore utilisée
    const usedColors = new Set(groups.filter((x) => !x.archived).map((x) => x.color));
    const color = (CLASS_COLORS.find((c) => !usedColors.has(c.value)) ?? CLASS_COLORS[groups.length % CLASS_COLORS.length]).value;
    const g: Group = { id: uid(), name: name.trim(), schoolYear: schoolYear(), subject, teacherIds: [session!.id], color };
    await db.groups.put(g);
    nav(`/prof/classes/${g.id}`);
  }

  const active = groups.filter((g) => !g.archived);
  const archived = groups.filter((g) => g.archived);

  return (
    <div className="page stack">
      <h1 className="title">Classes</h1>
      <div className="grid3">
        {active
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
          .map((g) => (
            <div key={g.id} className="panel stack" style={{ background: g.color ?? 'var(--paper)', gap: 8 }}>
              <Link to={`/prof/classes/${g.id}`} className="stack" style={{ textDecoration: 'none', gap: 8 }}>
                <h2 style={{ margin: 0 }}>{g.name}</h2>
                <div className="muted">
                  {g.subject} · {g.schoolYear}
                </div>
                <div>
                  <b>{counts.get(g.id) ?? 0}</b> élève(s)
                </div>
              </Link>
            </div>
          ))}
      </div>
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Nouvelle classe</h3>
        <div className="row">
          <input placeholder="Nom (ex. 4e C)" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="btn primary" onClick={create}>
            Créer
          </button>
        </div>
      </div>
      {archived.length > 0 && (
        <details>
          <summary>Classes archivées ({archived.length})</summary>
          <ul>
            {archived.map((g) => (
              <li key={g.id}>
                <Link to={`/prof/classes/${g.id}`}>
                  {g.name} ({g.schoolYear})
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function StatsTab({ groupId }: { groupId: string }) {
  const data = useLiveQuery(() => groupOverview(groupId), [groupId]);
  const cards = useLiveQuery(async () => (data ? db.cards.bulkGet(data.cards.slice(0, 12).map((c) => c.cardId)) : []), [data]);
  const nav = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <div className="muted">Calcul…</div>;
  const dropped = data.rows.filter((r) => r.inactiveDays === null || r.inactiveDays >= 5);

  return (
    <div className="stack">
      <div className="grid2">
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>Régularité de la classe</h3>
          <Heatmap counts={heatmapCounts(data.reviews)} weeks={16} />
        </div>
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>⚠️ À relancer ({dropped.length})</h3>
          <span className="small muted">Aucune révision depuis 5 jours ou plus.</span>
          {dropped.length ? (
            <div className="row" style={{ gap: 6 }}>
              {dropped.map((r) => (
                <Link key={r.student.id} to={`/prof/eleves/${r.student.id}?classe=${data.group.id}`} className="chip" style={{ textDecoration: 'none', padding: '2px 10px 2px 2px', background: 'var(--paper)' }}>
                  <StudentName student={r.student} size={26} short /> · {r.inactiveDays === null ? 'jamais' : `${r.inactiveDays} j`}
                </Link>
              ))}
            </div>
          ) : (
            <span>Tout le monde révise 🎉</span>
          )}
        </div>
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Cartes difficiles pour la classe</h3>
        <span className="small muted">Taux de réussite le plus bas (cartes vues au moins 3 fois). Cliquez pour voir la carte.</span>
        <div className="cardgrid">
          {data.cards.slice(0, 12).map((a, i) => {
            const c = cards?.[i];
            if (!c) return null;
            return (
              <div key={a.cardId} className="thumb" onClick={() => setOpen(c.id)}>
                <div className="face">
                  <CardFace html={c.front} />
                </div>
                <div className="meta" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <span className="code">{c.code}</span>
                  <RateBar agg={a} />
                </div>
              </div>
            );
          })}
        </div>
        {!data.cards.length && <span className="muted">Pas encore assez de révisions.</span>}
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Classement (30 derniers jours)</h3>
        <span className="small muted">Score = 50 % régularité (jours avec révision) + 50 % réussite (vert + orange). Visible par vous seul.</span>
        <div style={{ overflowX: 'auto' }}>
          <table className="list">
            <thead>
              <tr>
                <th>#</th>
                <th>Élève</th>
                <th>Score</th>
                <th>Régularité</th>
                <th>Réussite</th>
                <th>Cartes</th>
                <th>Dernière révision</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={r.student.id} className="click" onClick={() => nav(`/prof/eleves/${r.student.id}?classe=${data.group.id}`)}>
                  <td>{i + 1}</td>
                  <td>
                    <b>
                      <StudentName student={r.student} />
                    </b>
                  </td>
                  <td>
                    <b>{r.summary.score}</b>
                  </td>
                  <td>{r.summary.activeDays} j / 30</td>
                  <td>{r.summary.total ? <Pct v={r.summary.success} /> : '—'}</td>
                  <td>{r.summary.total}</td>
                  <td>
                    {r.summary.lastDay ? frDate(r.summary.lastDay) : 'jamais'}
                    {r.inactiveDays !== null && r.inactiveDays >= 5 && ' ⚠️'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && <CardDetail cardId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function StudentsTab({ group }: { group: Group }) {
  const students = useLiveQuery(async () => {
    const ms = await db.memberships.where('groupId').equals(group.id).toArray();
    const s = await db.students.bulkGet(ms.map((m) => m.studentId));
    return s.filter(Boolean).map((x) => x!).sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [group.id], []);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [msg, setMsg] = useState('');

  async function onCsv(f?: File) {
    if (!f) return;
    const buf = await f.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf); // export Excel/ENT
    setPreview(parseCsv(text));
  }

  async function confirmImport() {
    if (!preview) return;
    setMsg('Création des comptes…');
    let r;
    try {
      r = await importStudents(preview, group.id, group.subject);
    } catch (e) {
      return setMsg('Erreur : ' + (e as Error).message);
    }
    setMsg(`${r.created} élève(s) créé(s), ${r.reused} déjà connu(s) ajouté(s) à la classe.`);
    setPreview(null);
  }

  async function onPhotos(list: FileList | null) {
    if (!list?.length) return;
    const r = await importPhotos([...list], students);
    setMsg(
      `${r.matched} photo(s) associée(s).` +
        (r.unmatched.length ? ` Non reconnue(s) : ${r.unmatched.join(', ')} — ajoutez-les à la main en cliquant sur l'avatar.` : ''),
    );
  }

  async function addOne() {
    const full = prompt('Prénom et nom de l’élève (ex. « Léa Martin »)');
    if (!full) return;
    const [first, ...rest] = full.trim().split(/\s+/);
    try {
      await importStudents([{ firstName: first, lastName: rest.join(' ') || '-' }], group.id, group.subject);
    } catch (e) {
      setMsg('Erreur : ' + (e as Error).message);
    }
  }

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="spread">
          <h3 style={{ margin: 0 }}>{students.length} élève(s)</h3>
          <div className="row">
            <label className="btn">
              Importer un CSV
              <input type="file" accept=".csv,.txt" hidden onChange={(e) => onCsv(e.target.files?.[0])} />
            </label>
            <button className="btn" onClick={() => setPdfOpen(true)}>
              📄 Trombinoscope PDF
            </button>
            <label className="btn">
              📷 Photos (fichiers)
              <input type="file" accept="image/*" multiple hidden onChange={(e) => onPhotos(e.target.files)} />
            </label>
            <button className="btn ghost" onClick={addOne}>
              + Élève
            </button>
            <Link className="btn primary" to={`/prof/classes/${group.id}/fiches`}>
              🖨 Fiches identifiants
            </Link>
          </div>
        </div>
        <span className="small muted">
          CSV accepté : colonnes « Nom ; Prénom » (avec ou sans en-tête), ou export ENT/Pronote avec une colonne « Élève ».
          Un élève déjà connu de FoxBox est réutilisé (pas de doublon, il garde ses cartes).
          <br />
          Photos : sélectionnez plusieurs fichiers nommés avec le nom et le prénom (ex. « DUPONT Marie.jpg »,
          « marie.dupont.png ») ; ils sont associés automatiquement. Un clic sur l'avatar change une photo.
        </span>
        {msg && <div className="notice">{msg}</div>}
        {pdfOpen && <TrombiImport group={group} students={students} onClose={() => setPdfOpen(false)} />}
        {preview && (
          <div className="notice stack">
            <b>{preview.length} élève(s) trouvé(s) dans le fichier :</b>
            <div className="small">{preview.slice(0, 12).map((r) => `${r.firstName} ${r.lastName}`).join(' · ')}{preview.length > 12 && ' …'}</div>
            <div className="row">
              <button className="btn primary" onClick={confirmImport}>
                Importer dans {group.name}
              </button>
              <button className="btn ghost" onClick={() => setPreview(null)}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="list">
          <thead>
            <tr>
              <th>Élève</th>
              <th>Identifiant</th>
              <th>Mot de passe</th>
              <th>Objectif / jour</th>
              <th>Règle d'erreur</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                    <Avatar student={s} size={40} editable />
                    <Link to={`/prof/eleves/${s.id}?classe=${group.id}`}>
                      <b>
                        {s.lastName} {s.firstName}
                      </b>
                    </Link>
                    {!s.firstName && (
                      <Link to={`/prof/eleves/${s.id}?classe=${group.id}`} className="chip" style={{ background: '#f6c9c3', textDecoration: 'none' }}>
                        prénom à compléter
                      </Link>
                    )}
                  </span>
                </td>
                <td className="code">{s.login}</td>
                <td className="code">{s.password}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    style={{ width: 70 }}
                    value={s.goals[group.subject] ?? DEFAULT_GOAL}
                    onChange={(e) =>
                      db.students.update(s.id, { goals: { ...s.goals, [group.subject]: Math.max(1, Number(e.target.value)) } })
                    }
                  />
                </td>
                <td>
                  <select value={s.rule} onChange={(e) => db.students.update(s.id, { rule: e.target.value as Rule })}>
                    <option value="strict">Stricte (retour boîte 1)</option>
                    <option value="douce">Douce (−1 boîte)</option>
                  </select>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn small ghost"
                    onClick={() => confirm(`Nouveau mot de passe pour ${s.firstName} ?`) && resetPassword(s.id).catch((e) => alert(e.message))}
                  >
                    Nouveau mdp
                  </button>{' '}
                  <button
                    className="btn small ghost"
                    onClick={() =>
                      confirm(`Retirer ${s.firstName} ${s.lastName} de ${group.name} ? (son compte et ses cartes sont conservés)`) &&
                      db.memberships.delete(`${group.id}|${s.id}`)
                    }
                  >
                    Retirer
                  </button>{' '}
                  <button
                    className="btn small danger"
                    title="Supprimer définitivement l'élève"
                    onClick={() =>
                      confirm(
                        `Supprimer définitivement ${s.firstName} ${s.lastName} ?\n\nSon compte, sa photo, sa progression et son historique seront effacés, dans toutes ses classes. Cette action est irréversible.`,
                      ) && deleteStudent(s.id).catch((e) => alert(e.message))
                    }
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PublicationsTab({ group }: { group: Group }) {
  const pubs = useLiveQuery(async () => {
    const ps = await db.publications.where('groupId').equals(group.id).toArray();
    const out = [];
    for (const p of ps) {
      const u = await db.units.get(p.unitId);
      const parent = u?.parentId ? await db.units.get(u.parentId) : undefined;
      out.push({ p, label: u ? (parent ? `${parent.name} › ${u.name}` : u.name) : '(supprimée)' });
    }
    return out.sort((a, b) => b.p.date.localeCompare(a.p.date));
  }, [group.id], []);
  return (
    <div className="panel stack">
      <span className="small muted">Pour publier, allez dans l'onglet Séquences et choisissez une séquence ou une séance.</span>
      <table className="list">
        <thead>
          <tr>
            <th>Date</th>
            <th>Séquence / séance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pubs.map(({ p, label }) => (
            <tr key={p.id}>
              <td>{frDate(p.date)}</td>
              <td>{label}</td>
              <td style={{ textAlign: 'right' }}>
                <button className="btn small ghost" onClick={() => confirm('Annuler cette publication ?') && db.publications.delete(p.id)}>
                  Annuler
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!pubs.length && <span className="muted">Rien de publié pour l'instant.</span>}
    </div>
  );
}

function DeleteGroup({ group }: { group: Group }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [orphans, setOrphans] = useState(true);
  const [busy, setBusy] = useState('');
  async function go() {
    if (!confirm(`Supprimer définitivement la classe « ${group.name} » ?`)) return;
    setBusy('Suppression…');
    try {
      const n = await deleteGroup(group.id, orphans);
      alert(`Classe supprimée${n ? `, ainsi que ${n} élève(s)` : ''}.`);
      nav('/prof/classes');
    } catch (e) {
      setBusy('Erreur : ' + (e as Error).message);
    }
  }
  return (
    <div className="stack" style={{ borderTop: '2px dashed var(--muted-line)', paddingTop: 12 }}>
      {!open ? (
        <div>
          <button className="btn danger" onClick={() => setOpen(true)}>
            Supprimer la classe…
          </button>
        </div>
      ) : (
        <div className="notice stack" style={{ borderColor: 'var(--forgot)' }}>
          <b>Supprimer la classe « {group.name} »</b>
          <span className="small">Les publications de cette classe sont supprimées. Les cartes et les séquences sont conservées.</span>
          <label className="row small" style={{ gap: 8, fontWeight: 700 }}>
            <input type="checkbox" checked={orphans} onChange={(e) => setOrphans(e.target.checked)} />
            Supprimer aussi les élèves qui ne sont dans aucune autre classe (comptes, photos, progression)
          </label>
          <div className="row">
            <button className="btn danger" onClick={go} disabled={!!busy}>
              Supprimer définitivement
            </button>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
          {busy && <span>{busy}</span>}
        </div>
      )}
    </div>
  );
}

function TeachersTab({ group }: { group: Group }) {
  const teachers = useLiveQuery(() => db.teachers.toArray(), [], []);
  return (
    <div className="panel stack">
      <h3 style={{ margin: 0 }}>Couleur de la classe</h3>
      <div className="row" style={{ gap: 8 }}>
        {CLASS_COLORS.map((c) => (
          <button
            key={c.value}
            title={c.name}
            onClick={() => db.groups.update(group.id, { color: c.value })}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: c.value,
              cursor: 'pointer',
              border: group.color === c.value ? '3px solid var(--ink)' : '1.5px solid #00000033',
              padding: 0,
            }}
          />
        ))}
      </div>
      <h3 style={{ margin: '8px 0 0' }}>Co-enseignants</h3>
      <span className="small muted">
        Plusieurs professeurs peuvent gérer la même classe (mêmes élèves, sans doublon). L'invitation de collègues se fera
        avec la version en ligne.
      </span>
      {teachers.map((t) => (
        <label key={t.id} className="row" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={group.teacherIds.includes(t.id)}
            onChange={(e) =>
              db.groups.update(group.id, {
                teacherIds: e.target.checked ? [...group.teacherIds, t.id] : group.teacherIds.filter((x) => x !== t.id),
              })
            }
          />
          {t.name}
        </label>
      ))}
      <div>
        <button
          className="btn ghost"
          onClick={() =>
            confirm(group.archived ? 'Réactiver cette classe ?' : 'Archiver cette classe ? Les élèves gardent leurs comptes et leurs cartes.') &&
            db.groups.update(group.id, { archived: !group.archived })
          }
        >
          {group.archived ? 'Réactiver la classe' : 'Archiver la classe (fin d’année)'}
        </button>
      </div>
      <DeleteGroup group={group} />
    </div>
  );
}

export function GroupPage() {
  const { id } = useParams();
  const group = useLiveQuery(async () => (await db.groups.get(id!)) ?? null, [id]);
  // Onglet gardé dans l'adresse : le retour depuis une fiche élève revient au même onglet
  const [params, setParams] = useSearchParams();
  type Tab = 'stats' | 'eleves' | 'pubs' | 'profs';
  const tab = (params.get('onglet') as Tab) || 'stats';
  const setTab = (t: Tab) => setParams({ onglet: t }, { replace: true });
  if (group === undefined) return null;
  if (!group) return <div className="page muted">Classe introuvable.</div>;
  const tabs = [
    ['stats', 'Statistiques'],
    ['eleves', 'Élèves'],
    ['pubs', 'Publications'],
    ['profs', 'Réglages'],
  ] as const;
  return (
    <div className="page stack">
      <div className="spread">
        <div>
          <Link to="/prof/classes" className="small muted">
            ← Classes
          </Link>
          <h1 className="title" style={{ margin: 0 }}>
            <span style={{ background: group.color, borderRadius: 12, padding: '0 10px' }}>{group.name}</span>
          </h1>
          <div className="muted">
            {group.subject} · {group.schoolYear} {group.archived && '· archivée'}
          </div>
        </div>
        <nav className="nav" style={{ flex: 'none' }}>
          {tabs.map(([k, l]) => (
            <a key={k} href="#" className={tab === k ? 'active' : ''} onClick={(e) => (e.preventDefault(), setTab(k))}>
              {l}
            </a>
          ))}
        </nav>
      </div>
      {tab === 'stats' && <StatsTab groupId={group.id} />}
      {tab === 'eleves' && <StudentsTab group={group} />}
      {tab === 'pubs' && <PublicationsTab group={group} />}
      {tab === 'profs' && <TeachersTab group={group} />}
    </div>
  );
}
