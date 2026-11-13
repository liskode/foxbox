// Bouton « Écouter » d'une flashcard de vocabulaire de langue (n'apparaît que si l'appareil a la voix de cette langue)
import type { Card } from '../lib/db';
import { speak, speechLang, textToSpeak, useVoice } from '../lib/speech';
import { Icon } from './Icon';

export function SpeakButton({ card }: { card: Card }) {
  const voice = useVoice(speechLang(card));
  if (!voice) return null;
  return (
    <button className="btn small ghost" title="Écouter la réponse" onClick={() => speak(textToSpeak(card.back), voice)}>
      <Icon name="volume" size={16} /> Écouter
    </button>
  );
}
