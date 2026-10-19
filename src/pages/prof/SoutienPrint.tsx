// Soutien scolaire : relevé mensuel et attestation annuelle, à imprimer (Imprimer › Enregistrer au format PDF).
import { useParams, useSearchParams } from 'react-router-dom';
import { Attestation, Statement } from '../../components/Billing';
import { monthOf } from '../../lib/billing';
import { today } from '../../lib/dates';
import { Icon } from '../../components/Icon';

function Toolbar() {
  return (
    <div className="spread noprint">
      <a href="#" className="small muted" onClick={(e) => (e.preventDefault(), history.back())}>
        ← Retour
      </a>
      <button className="btn primary" onClick={() => window.print()}>
        <Icon name="print" /> Imprimer ou enregistrer en PDF
      </button>
    </div>
  );
}

export function RelevePage() {
  const { studentId } = useParams();
  const [params] = useSearchParams();
  return (
    <div className="page stack" style={{ maxWidth: 800 }}>
      <Toolbar />
      <Statement studentId={studentId!} month={params.get('mois') ?? monthOf(today())} />
    </div>
  );
}

export function AttestationPage() {
  const { studentId } = useParams();
  const [params] = useSearchParams();
  return (
    <div className="page stack" style={{ maxWidth: 800 }}>
      <Toolbar />
      <Attestation studentId={studentId!} year={params.get('annee') ?? today().slice(0, 4)} />
    </div>
  );
}
