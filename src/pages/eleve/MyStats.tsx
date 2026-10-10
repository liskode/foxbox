// Espace élève : mes notes (évaluations rendues par le professeur)
import { useAuth } from '../../lib/auth';
import { MyEvaluations } from '../../components/MyEvaluations';

export function MyStats() {
  const { session } = useAuth();
  return (
    <div className="page narrow stack">
      <h1 className="title">Mes notes</h1>
      <MyEvaluations studentId={session!.id} />
    </div>
  );
}
