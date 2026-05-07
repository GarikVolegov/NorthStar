/**
 * wendy-voice.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Due funzionalità:
 *
 * 1. speak(text, opts?) — Web Speech API configurata per una voce italiana
 *    femminile elegante, piacevole, umana.
 *    - Pitch leggermente sopra al neutro (1.12) → suona femminile senza essere
 *      artificialmente acuta
 *    - Rate rallentato (0.88) → articolazione chiara, non robotica
 *    - Volume pieno (1.0) ma ridotto automaticamente se il pad è attivo
 *    - Priorità voci: Google italiano → Microsoft italiano → qualsiasi it-IT
 *      → fallback sistema
 *
 * 2. startAmbientPad() / stopAmbientPad()
 *    Genera un pad armonico via Web Audio API senza file esterni.
 *    Stack: oscillatori sine detuned + filtro low-pass 400Hz + LFO di ampiezza
 *    → risultato: suono caldo, quasi "breathing", non percussivo.
 *    Il volume è molto basso (gain 0.04) per non sovrastare la voce.
 */

const VOICE_PITCH  = 1.12;
const VOICE_RATE   = 0.88;
const VOICE_VOLUME = 1.0;
const PAD_GAIN     = 0.038;  // molto basso: sottofondo, non protagonista
const PAD_LFO_FREQ = 0.08;   // Hz — pulsazione lentissima (≈12 secondi/ciclo)

// ── Selezione voce ──────────────────────────────────────────────────────────
function pickItalianFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Ordine di preferenza: più naturale → più generico
  const PRIORITY = [
    (v: SpeechSynthesisVoice) => /google.*italian/i.test(v.name),
    (v: SpeechSynthesisVoice) => /microsoft.*elsa/i.test(v.name),       // Elsa = it-IT
    (v: SpeechSynthesisVoice) => /microsoft.*italian/i.test(v.name),
    (v: SpeechSynthesisVoice) => v.lang.startsWith("it") && !v.localService,
    (v: SpeechSynthesisVoice) => v.lang.startsWith("it"),
  ];

  for (const test of PRIORITY) {
    const match = voices.find(test);
    if (match) return match;
  }
  return null;
}

// ── speak() ─────────────────────────────────────────────────────────────────
export interface SpeakOptions {
  /** Interrompe eventuale speech in corso prima di parlare (default: true) */
  interrupt?: boolean;
  /** Callback quando la voce finisce */
  onEnd?: () => void;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (typeof speechSynthesis === "undefined" || !text.trim()) return;

  const { interrupt = true, onEnd } = opts;
  if (interrupt) speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang   = "it-IT";
  utter.pitch  = VOICE_PITCH;
  utter.rate   = VOICE_RATE;
  utter.volume = VOICE_VOLUME;

  // Tenta di assegnare la voce migliore disponibile;
  // se non trova nulla, il browser usa il default di sistema.
  const voice = pickItalianFemaleVoice();
  if (voice) utter.voice = voice;

  if (onEnd) utter.onend = () => onEnd();

  // Su Chrome le voci sono caricate async — ritentiamo se ancora vuote
  if (!speechSynthesis.getVoices().length) {
    speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        const v = pickItalianFemaleVoice();
        if (v) utter.voice = v;
        speechSynthesis.speak(utter);
      },
      { once: true },
    );
  } else {
    speechSynthesis.speak(utter);
  }
}

export function stopSpeech(): void {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

// ── Ambient pad (Web Audio API) ──────────────────────────────────────────────
interface PadNode {
  ctx: AudioContext;
  masterGain: GainNode;
  oscillators: OscillatorNode[];
  lfo: OscillatorNode;
  lfoGain: GainNode;
}

let activePad: PadNode | null = null;

/**
 * Frequenze fondamentali del pad: accordo Am pentatonico aperto
 * 110 Hz (A2) · 165 Hz (E3) · 220 Hz (A3) · 277 Hz (C#4)
 * + due oscillatori detuned ±4 cent per effetto chorus naturale
 */
const PAD_FREQUENCIES = [
  { freq: 110.0, detune:  0   },
  { freq: 110.0, detune:  4   },  // chorus su A2
  { freq: 165.0, detune:  0   },
  { freq: 220.0, detune: -4   },  // chorus su A3
  { freq: 277.0, detune:  0   },
];

export function startAmbientPad(): void {
  if (activePad) return; // già attivo
  if (typeof AudioContext === "undefined" && typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext === "undefined") return;

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  // Filtro low-pass per togliere brillantezza → suono caldo, setoso
  const lpf = ctx.createBiquadFilter();
  lpf.type            = "lowpass";
  lpf.frequency.value = 400;
  lpf.Q.value         = 0.7;

  // Gain master — bassissimo per non distrarre
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0; // parte muto, fade-in sotto
  masterGain.connect(ctx.destination);
  lpf.connect(masterGain);

  // LFO di ampiezza → pulsazione lenta tipo "respiro"
  const lfo = ctx.createOscillator();
  lfo.type            = "sine";
  lfo.frequency.value = PAD_LFO_FREQ;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value  = PAD_GAIN * 0.4; // profondità modulazione
  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);
  lfo.start();

  // Oscillatori
  const oscillators: OscillatorNode[] = PAD_FREQUENCIES.map(({ freq, detune }) => {
    const osc = ctx.createOscillator();
    osc.type            = "sine";
    osc.frequency.value = freq;
    osc.detune.value    = detune;
    osc.connect(lpf);
    osc.start();
    return osc;
  });

  // Fade-in graduale (2 secondi)
  masterGain.gain.linearRampToValueAtTime(PAD_GAIN, ctx.currentTime + 2);

  activePad = { ctx, masterGain, oscillators, lfo, lfoGain };
}

export function stopAmbientPad(fadeSec = 2): void {
  if (!activePad) return;
  const { ctx, masterGain, oscillators, lfo } = activePad;

  // Fade-out
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeSec);

  setTimeout(() => {
    oscillators.forEach((o) => { try { o.stop(); } catch {} });
    try { lfo.stop(); } catch {}
    try { ctx.close(); } catch {}
    activePad = null;
  }, fadeSec * 1000 + 100);
}
