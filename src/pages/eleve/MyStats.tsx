import { useAuth } from '../../lib/auth';
import { StudentReport } from '../../components/StudentReport';
import { MyEvaluations } from '../../components/MyEvaluations';

export function MyStats() {
  const { session } = useAuth();
  return (
    <div className="page stack">
      <h1 className="title">Mes progrès</h1>
      <MyEvaluations studentId={session!.id} />
      <StudentReport studentId={session!.id} />
    </div>
  );
}
