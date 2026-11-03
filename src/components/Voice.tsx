// Mémos vocaux (messages, appréciation vocale des copies) : un seul enregistreur pour toute l'appli.
// Enregistrer → réécouter → valider (ou recommencer, annuler) ; bouton « ? » d'aide si le micro ne marche pas.
import { useEffect, useState } from 'react';
import { Icon } from './Icon';

type Problem = 'refuse' | 'impossible' | null;

// Enregistrement : un appui pour démarrer, un autre pour arrêter ; le vocal est gardé pour être réécouté
export function useVoiceRecorder() {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [since, setSince] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [rec]);
  async function start() {
    setProblem(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return setProblem('impossible');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      const r = new MediaRecorder(stream, { mimeType: type });
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        const b = Object.assign(new Blob(chunks, { type }), { name: `vocal.${type === 'audio/mp4' ? 'm4a' : 'webm'}` });
        if (b.size) setBlob(b);
      };
      r.start();
      setSince(Date.now());
      setRec(r);
    } catch {
      setProblem('refuse');
    }
  }
  const stop = () => rec?.stop();
  const secs = rec ? Math.floor((Date.now() - since) / 1000) : 0;
  return {
    recording: !!rec,
    blob,
    problem,
    start,
    stop,
    clear: () => setBlob(null),
    elapsed: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
  };
}

// Bouton d'enregistrement complet : vocal à réécouter avant de le valider
export function VoiceRecorder({
  onValidate,
  label = 'Mémo vocal',
  validateLabel = 'Envoyer',
  disabled = false,
  primary = false,
  small = false,
}: {
  onValidate: (blob: Blob) => unknown;
  label?: string;
  validateLabel?: string;
  disabled?: boolean;
  primary?: boolean;
  small?: boolean;
}) {
  const v = useVoiceRecorder();
  const [help, setHelp] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!v.blob) return setUrl(null);
    const u = URL.createObjectURL(v.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [v.blob]);
  useEffect(() => {
    if (v.problem) setHelp(true);
  }, [v.problem]);
  const sz = small ? ' small' : '';

  if (v.blob && url)
    return (
      <div className="voice-review">
        <span className="small muted">Réécoute avant d'envoyer :</span>
        <audio controls src={url} style={{ width: '100%', maxWidth: 320 }} />
        <div className="row" style={{ gap: 8 }}>
          <button
            className={'btn primary' + sz}
            onClick={async () => {
              await onValidate(v.blob!);
              v.clear();
            }}
          >
            <Icon name="check" size={15} /> {validateLabel}
          </button>
          <button className={'btn' + sz} onClick={() => (v.clear(), v.start())}>
            <Icon name="mic" size={15} /> Recommencer
          </button>
          <button className={'btn ghost' + sz} onClick={v.clear}>
            Annuler
          </button>
        </div>
      </div>
    );

  return (
    <span className="voice-rec">
      {v.recording ? (
        <button className={'btn danger' + sz} onClick={v.stop}>
          <Icon name="x" size={15} /> Arrêter ({v.elapsed})
        </button>
      ) : (
        <button className={'btn' + (primary ? ' primary' : '') + sz} onClick={v.start} disabled={disabled}>
          <Icon name="mic" size={15} /> {label}
        </button>
      )}
      <button className={'btn ghost' + sz + ' voice-help-btn'} title="Le micro ne marche pas ?" aria-label="Aide pour le micro" onClick={() => setHelp(!help)}>
        ?
      </button>
      {help && <MicHelp problem={v.problem} onClose={() => setHelp(false)} />}
    </span>
  );
}

// Aide au micro, selon l'appareil (repéré automatiquement, les autres cas restent consultables)
const GUIDES: { key: string; title: string; steps: string[] }[] = [
  {
    key: 'ios',
    title: 'iPhone ou iPad',
    steps: [
      'Dans la barre d’adresse, appuie sur « aA » (ou sur l’icône à gauche de l’adresse).',
      'Choisis « Réglages du site web », puis Microphone : « Autoriser ».',
      'Si ça ne suffit pas : Réglages du téléphone › Safari › Microphone › « Autoriser ».',
      'Recharge la page et réessaie.',
    ],
  },
  {
    key: 'android',
    title: 'Téléphone Android (Chrome)',
    steps: [
      'Appuie sur le petit cadenas (ou les réglages) à gauche de l’adresse.',
      'Autorisations › Micro › « Autoriser ».',
      'Si ça ne suffit pas : Paramètres du téléphone › Applications › Chrome › Autorisations › Micro › « Autoriser ».',
      'Recharge la page et réessaie.',
    ],
  },
  {
    key: 'mac-safari',
    title: 'Mac avec Safari',
    steps: [
      'Menu Safari › Réglages › Sites web › Microphone : à côté de FoxBox, choisis « Autoriser ».',
      'Si ça ne suffit pas : menu Pomme › Réglages Système › Confidentialité et sécurité › Microphone : active Safari.',
      'Recharge la page et réessaie.',
    ],
  },
  {
    key: 'chrome',
    title: 'Ordinateur avec Chrome ou Edge',
    steps: [
      'Clique sur le cadenas (ou les réglages) à gauche de l’adresse.',
      'Micro : « Autoriser ».',
      'Sur Mac : Réglages Système › Confidentialité et sécurité › Microphone : active Chrome (ou Edge). Sur Windows : Paramètres › Confidentialité › Microphone : autorise les applications.',
      'Recharge la page et réessaie.',
    ],
  },
  {
    key: 'firefox',
    title: 'Firefox',
    steps: ['Clique sur l’icône du micro barré dans la barre d’adresse, puis « Autoriser ».', 'Recharge la page et réessaie.'],
  },
];
function detect() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Firefox/.test(ua)) return 'firefox';
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Edg/.test(ua)) return 'mac-safari';
  return 'chrome';
}

export function MicHelp({ problem, onClose }: { problem?: Problem; onClose: () => void }) {
  const mine = detect();
  const first = GUIDES.find((g) => g.key === mine)!;
  return (
    <div className="panel pop stack mic-help" style={{ gap: 8 }}>
      <div className="spread">
        <b>{problem === 'impossible' ? 'Cet appareil ne permet pas d’enregistrer ici' : 'Le micro ne marche pas ?'}</b>
        <button className="btn small ghost" onClick={onClose} aria-label="Fermer">
          <Icon name="x" size={14} />
        </button>
      </div>
      {problem === 'impossible' ? (
        <span className="small">Essaie avec un autre navigateur (Safari sur iPhone, Chrome ailleurs) ou un autre appareil.</span>
      ) : (
        <>
          {problem === 'refuse' && <span className="small">Le micro a été refusé. Voici comment l’autoriser :</span>}
          <b className="small">{first.title}</b>
          <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
            {first.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <details className="small">
            <summary style={{ cursor: 'pointer' }}>Autre appareil ou navigateur</summary>
            {GUIDES.filter((g) => g.key !== mine).map((g) => (
              <div key={g.key} style={{ marginTop: 6 }}>
                <b>{g.title}</b>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  {g.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </details>
          <span className="small muted">Vérifie aussi qu’aucune autre appli (visio, jeu…) n’utilise déjà le micro.</span>
        </>
      )}
    </div>
  );
}
