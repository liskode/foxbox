// Lecture à voix haute de la réponse des flashcards de vocabulaire des langues,
// avec la synthèse vocale de l'appareil (voix tchèque « Zuzana » sur iPhone, iPad et Mac).
import { useEffect, useState } from 'react';
import type { Card } from './db';

// Langue lue pour chaque matière de langue vivante
const LANG_OF_SUBJECT: Record<string, string> = { Tchèque: 'cs' };

// Langue à lire pour cette flashcard : seulement pour le vocabulaire d'une langue
export const speechLang = (c: Pick<Card, 'subject' | 'theme'>) => (c.theme === 'Vocabulaire' ? LANG_OF_SUBJECT[c.subject] : undefined);

// Texte à lire : les passages en gras du verso (« **Dobrý den** »), sinon tout le verso sans mise en forme
export function textToSpeak(back: string) {
  const bold = [...back.matchAll(/\*\*(.+?)\*\*|<(?:b|strong)>(.+?)<\/(?:b|strong)>/g)].map((m) => m[1] ?? m[2]);
  const raw = bold.length ? bold.join('. ') : back;
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`]/g, '')
    .replace(/\s\/\s/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Voix de l'appareil pour une langue (null si l'appareil n'en a pas : le bouton n'est alors pas affiché)
export function useVoice(lang?: string) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (!lang || typeof speechSynthesis === 'undefined') return setVoice(null);
    const pick = () => setVoice(speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null);
    pick();
    speechSynthesis.addEventListener('voiceschanged', pick);
    return () => speechSynthesis.removeEventListener('voiceschanged', pick);
  }, [lang]);
  return voice;
}

export function speak(text: string, voice: SpeechSynthesisVoice) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.9; // un peu plus lent, pour bien entendre
  speechSynthesis.speak(u);
}
