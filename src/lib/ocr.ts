// Lecture automatique du texte des images (pour la recherche), en arrière-plan.
import { createWorker, type Worker } from 'tesseract.js';
import { db } from './db';

type Listener = (s: OcrState) => void;
export interface OcrState {
  running: boolean;
  done: number;
  total: number;
}

let state: OcrState = { running: false, done: 0, total: 0 };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(state));

export function subscribeOcr(l: Listener) {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

async function readFace(worker: Worker, html: string): Promise<string> {
  const ids = [...html.matchAll(/src="media:([^"]+)"/g)].map((m) => m[1]);
  const parts: string[] = [];
  for (const id of ids) {
    const media = await db.media.get(id);
    if (!media) continue;
    const { data } = await worker.recognize(media.blob);
    parts.push(data.text);
  }
  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*\d{1,3}\s+/, '') // numéro de planche en haut de la carte
    .trim();
}

let starting = false;

export async function runOcr() {
  if (state.running || starting) return;
  starting = true;
  const todo = await db.cards
    .filter((c) => !c.deleted && !c.ocrDone && /src="media:/.test(c.front + c.back))
    .toArray()
    .finally(() => (starting = false));
  if (!todo.length) return;
  state = { running: true, done: 0, total: todo.length };
  emit();
  const worker = await createWorker('fra');
  try {
    for (const c of todo) {
      const ocrFront = await readFace(worker, c.front);
      const ocrBack = await readFace(worker, c.back);
      await db.cards.update(c.id, { ocrFront, ocrBack, ocrDone: true });
      state = { ...state, done: state.done + 1 };
      emit();
    }
  } finally {
    await worker.terminate();
    state = { ...state, running: false };
    emit();
  }
}
