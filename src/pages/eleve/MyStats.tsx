// Espace élève : ses évaluations (DS signalés, notes, copies, progression) et les évaluations corrigées en classe dans FoxBox
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db, isTutoring } from '../../lib/db';
import { MyEvaluations } from '../../components/MyEvaluations';
import { AssessmentsPanel } from '../../components/Assessments';

export function MyStats() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const fromClass = useLiveQuery(() => db.resultShares.where('studentId').equals(session!.id).count(), [session], 0);
  // « Signaler un DS à venir » et le suivi des DS : seulement pour les élèves suivis en soutien (hors classe)
  const tutored = useLiveQuery(
    async () => {
      const ms = await db.memberships.where('studentId').equals(session!.id).toArray();
      return (await db.groups.bulkGet(ms.map((m) => m.groupId))).some((g) => isTutoring(g) && !g!.archived);
    },
    [session],
    false,
  );
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>
        Évaluations
      </h1>
      {tutored && <AssessmentsPanel studentId={session!.id} meId={session!.id} canGrade hideTitle startOpen={params.get('nouveau') === '1'} />}
      {!tutored && !fromClass && <div className="notice">Pas encore d'évaluation corrigée.</div>}
      {fromClass > 0 && (
        <>
          {tutored && <h2 style={{ margin: '8px 0 0' }}>Corrigées en classe</h2>}
          <MyEvaluations studentId={session!.id} />
        </>
      )}
    </div>
  );
}
