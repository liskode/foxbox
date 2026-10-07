import { useAuth } from '../../lib/auth';
import { StudentReport } from '../../components/StudentReport';

export function MyStats() {
  const { session } = useAuth();
  return (
    <div className="page stack">
      <h1 className="title">Mes progrès</h1>
      <StudentReport studentId={session!.id} />
    </div>
  );
}
