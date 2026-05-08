/**
 * wendy-voice.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Funzionalità:
 *   1. speak()            — Web Speech API, voce italiana femminile elegante
 *   2. startAmbientPad()  — pad armonico via AudioContext (Am pentatonico)
 *   3. setMuted(bool)     — mute globale: silenzia voce + pad in realtime
 *   4. getMuted()         — legge stato mute corrente
 *   5. subscribe(fn)      — notifica i listener React quando cambia il mute
 */

const VOICE_PITCH  = 1.12;
const VOICE_RATE   = 0.88;
const VOICE_VOLUME = 1.0;
const PAD_GAIN     = 0.038;
const PAD_LFO_FREQ = 0.08;
const MUTE_KEY     = "wendy_muted";

// ── Stato mute ───────────────────────────────────────────────────────────────
let muted: boolean = (() => {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
})();

const listeners = new Set<(m: boolean) => void>();

export function getMuted(): boolean { return muted; }

export function subscribe(fn: (m: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setMuted(value: boolean): void {
  muted = value;
  try { localStorage.setItem(MUTE_KEY, value ? "1" : "0"); } catch {}
  listeners.forEach((fn) => fn(value));

  if (value) {
    // Muta immediatamente
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setPadMuted(true);
  } else {
    // Riattiva pad se era attivo
    setPadMuted(false);
  }
}

export function toggleMuted(): void { setMuted(!muted); }

// ── Selezione voce ──────────────────────────────────────────────────────────
function pickItalianFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const PRIORITY = [
    (v: SpeechSynthesisVoice) => /google.*italian/i.test(v.name),
    (v: SpeechSynthesisVoice) => /microsoft.*elsa/i.test(v.name),
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
  interrupt?: boolean;
  onEnd?: () => void;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  // Non fa nulla se mutato
  if (muted) return;
  if (typeof speechSynthesis === "undefined" || !text.trim()) return;

  const { interrupt = true, onEnd } = opts;
  if (interrupt) speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang   = "it-IT";
  utter.pitch  = VOICE_PITCH;
  utter.rate   = VOICE_RATE;
  utter.volume = VOICE_VOLUME;

  const voice = pickItalianFemaleVoice();
  if (voice) utter.voice = voice;
  if (onEnd) utter.onend = () => onEnd();

  if (!speechSynthesis.getVoices().length) {
    speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        if (muted) return; // ricontrolla: potrebbe essere stato mutato nel frattempo
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

const PAD_FREQUENCIES = [
  { freq: 110.0, detune:  0 },
  { freq: 110.0, detune:  4 },
  { freq: 165.0, detune:  0 },
  { freq: 220.0, detune: -4 },
  { freq: 277.0, detune:  0 },
];

export function startAmbientPad(): void {
  if (activePad) return;
  if (typeof AudioContext === "undefined" && typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext === "undefined") return;

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  const lpf = ctx.createBiquadFilter();
  lpf.type            = "lowpass";
  lpf.frequency.value = 400;
  lpf.Q.value         = 0.7;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(ctx.destination);
  lpf.connect(masterGain);

  const lfo = ctx.createOscillator();
  lfo.type            = "sine";
  lfo.frequency.value = PAD_LFO_FREQ;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value  = PAD_GAIN * 0.4;
  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);
  lfo.start();

  const oscillators: OscillatorNode[] = PAD_FREQUENCIES.map(({ freq, detune }) => {
    const osc = ctx.createOscillator();
    osc.type            = "sine";
    osc.frequency.value = freq;
    osc.detune.value    = detune;
    osc.connect(lpf);
    osc.start();
    return osc;
  });

  activePad = { ctx, masterGain, oscillators, lfo, lfoGain };

  // Fade-in solo se non mutato
  if (!muted) {
    masterGain.gain.linearRampToValueAtTime(PAD_GAIN, ctx.currentTime + 2);
  }
}

/** Muta o riattiva il pad in realtime con fade di 0.4s */
export function setPadMuted(value: boolean): void {
  if (!activePad) return;
  const { ctx, masterGain } = activePad;
  const target = value ? 0 : PAD_GAIN;
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.4);
}

export function stopAmbientPad(fadeSec = 2): void {
  if (!activePad) return;
  const { ctx, masterGain, oscillators, lfo } = activePad;
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeSec);
  setTimeout(() => {
    oscillators.forEach((o) => { try { o.stop(); } catch {} });
    try { lfo.stop(); } catch {}
    try { ctx.close(); } catch {}
    activePad = null;
  }, fadeSec * 1000 + 100);
}
