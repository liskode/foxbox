import { useParams } from 'react-router-dom';
import { SequenceScreen } from './progression/SequenceScreen';
import { LevelsOverview } from './progression/LevelsOverview';

export function Sequences() {
  const { seqId } = useParams();
  return seqId ? <SequenceScreen seqId={seqId} /> : <LevelsOverview />;
}
