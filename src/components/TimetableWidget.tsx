// Tableau de bord : cours du jour (ou du prochain jour de présence) et grille de la semaine A/B.
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Group } from "../lib/db";
import { addDays, today } from "../lib/dates";
import {
  isPresent,
  dayOf,
  mondayOf,
  nextSchoolWeek,
  nextTeachingDay,
  slotsOn,
  weekType,
} from "../lib/timetable";
import {
  DayList,
  WeekGrid,
  longDate,
  useGroups,
  useTimetable,
} from "./TimetableView";

const WeekChip = ({ w }: { w: "A" | "B" | null }) => (
  <span
    className="chip"
    style={{
      background:
        w === "A" ? "#f2c14e" : w === "B" ? "#7fb8e6" : "var(--paper)",
    }}
  >
    {w ? `Semaine ${w}` : "Vacances"}
  </span>
);

export function TimetableWidget() {
  const tt = useTimetable();
  const groups = useGroups();
  const t = today();
  // Le week-end, on montre directement la semaine suivante
  const [monday, setMonday] = useState(() =>
    mondayOf(dayOf(t) === 6 || dayOf(t) === 0 ? addDays(t, 2) : t),
  );
  if (!tt) return null;

  if (!tt.slots.length)
    return (
      <div className="panel stack">
        <div className="spread">
          <span>
            <b>Emploi du temps</b>{" "}
            <span className="muted small">
              — importez vos PDF Pronote (semaine A et semaine B).
            </span>
          </span>
          <Link to="/prof/edt" className="btn small primary">
            Ajouter mon emploi du temps
          </Link>
        </div>
        <ClassChips groups={groups} />
      </div>
    );

  if (!Object.keys(tt.weeks).length)
    return (
      <div className="panel stack">
        <div className="spread">
          <span>
            <b>Emploi du temps</b>{" "}
            <span className="muted small">
              — il manque le calendrier des semaines A / B et des vacances.
            </span>
          </span>
          <Link to="/prof/edt" className="btn small primary">
            Compléter le calendrier
          </Link>
        </div>
        <ClassChips groups={groups} />
      </div>
    );

  // Jour affiché à gauche : aujourd'hui si j'ai cours, sinon le prochain jour de présence avec des cours
  const todayOk = isPresent(tt, dayOf(t)) && slotsOn(tt, t).length > 0;
  const day = todayOk ? t : nextTeachingDay(tt, addDays(t, 1));
  const w = weekType(tt, monday);
  const vacation = !weekType(tt, t);
  const resume = vacation ? nextSchoolWeek(tt, t) : null;

  return (
    <div className="panel stack">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Emploi du temps</h2>
        <Link to="/prof/edt" className="btn small ghost">
          Modifier
        </Link>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div className="stack" style={{ gap: 8 }}>
          {vacation && (
            <div className="notice">
              🌴 Vacances
              {resume
                ? ` — reprise le ${longDate(resume)} (semaine ${tt.weeks[resume]})`
                : ""}
            </div>
          )}
          {day ? (
            <>
              <div className="row" style={{ gap: 8 }}>
                <h3 style={{ margin: 0 }}>
                  {day === t
                    ? "Aujourd'hui"
                    : day === addDays(t, 1)
                      ? "Demain"
                      : "Prochain cours"}
                </h3>
                <span className="small muted">{longDate(day)}</span>
                <WeekChip w={weekType(tt, day)} />
              </div>
              <DayList tt={tt} groups={groups} date={day} />
            </>
          ) : (
            !vacation && (
              <span className="muted">
                Aucun cours à venir dans le calendrier.
              </span>
            )
          )}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn small ghost"
              onClick={() => setMonday(addDays(monday, -7))}
              title="Semaine précédente"
            >
              ←
            </button>
            <WeekChip w={w} />
            <span className="small muted">
              du {longDate(monday).replace(/^\S+ /, "")}
            </span>
            <button
              className="btn small ghost"
              onClick={() => setMonday(addDays(monday, 7))}
              title="Semaine suivante"
            >
              →
            </button>
            {monday !== mondayOf(t) && (
              <button
                className="btn small ghost"
                onClick={() => setMonday(mondayOf(t))}
              >
                Cette semaine
              </button>
            )}
          </div>
          {w ? (
            <WeekGrid tt={tt} groups={groups} monday={monday} compact />
          ) : (
            <div className="notice">Pas de cours cette semaine (vacances).</div>
          )}
        </div>
      </div>
      <ClassChips groups={groups} />
    </div>
  );
}

// Accès direct aux classes (utile pendant les vacances, ou pour une classe hors emploi du temps)
function ClassChips({ groups }: { groups: Group[] }) {
  const sorted = [...groups].sort((a, b) =>
    a.name.localeCompare(b.name, "fr", { numeric: true }),
  );
  return (
    <div className="row" style={{ gap: 6 }}>
      <span className="small muted">Classes :</span>
      {sorted.map((g) => (
        <Link
          key={g.id}
          to={`/prof/classes/${g.id}?onglet=apercu`}
          className="chip"
          style={{
            background: g.color ?? "var(--paper)",
            textDecoration: "none",
          }}
        >
          {g.name}
        </Link>
      ))}
    </div>
  );
}
