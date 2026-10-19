// Espace élève : ses évaluations (DS signalés, notes, copies, progression) et les évaluations corrigées en classe dans FoxBox
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { MyEvaluations } from '../../components/MyEvaluations';
import { AssessmentsPanel } from '../../components/Assessments';

export function MyStats() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const fromClass = useLiveQuery(() => db.resultShares.where('studentId').equals(session!.id).count(), [session], 0);
  return (
    <div className="page narrow stack">
      <h1 className="title" style={{ margin: 0 }}>
        Évaluations
      </h1>
      <AssessmentsPanel studentId={session!.id} meId={session!.id} canGrade hideTitle startOpen={params.get('nouveau') === '1'} />
      {fromClass > 0 && (
        <>
          <h2 style={{ margin: '8px 0 0' }}>Corrigées en classe</h2>
          <MyEvaluations studentId={session!.id} />
        </>
      )}
    </div>
  );
}
