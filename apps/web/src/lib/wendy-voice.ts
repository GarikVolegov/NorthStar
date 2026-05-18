/**
 * wendy-voice.ts
 * ──────────────────────────────────────────────────────────────────────
 * 1. speak(text, opts?)  — Web Speech API femminile italiana elegante
 * 2. stopSpeech()        — cancella speech in corso
 * 3. setMuted(bool)      — mute globale: blocca speak + silenzia pad
 * 4. isMuted()           — legge lo stato mute corrente
 * 5. startAmbientPad()   — pad armonico via AudioContext (Am pentatonico)
 * 6. stopAmbientPad()    — fade-out e dispose del pad
 *
 * SpeakOptions callbacks:
 *   onBoundary(charIndex) — scatta ad ogni parola (nativo onboundary)
 *   onEnd()               — scatta al termine della lettura
 */

const VOICE_PITCH  = 1.12;
const VOICE_RATE   = 0.88;
const VOICE_VOLUME = 1.0;
const PAD_GAIN     = 0.038;
const PAD_LFO_FREQ = 0.08;

// ── Stato mute globale ─────────────────────────────────────────────────
let _muted = false;
const _mutedListeners: Set<(muted: boolean) => void> = new Set();

export function isMuted(): boolean { return _muted; }
export const getMuted = isMuted; // Alias for backward compatibility

export function setMuted(value: boolean): void {
   if (_muted === value) return;
   _muted = value;
   _mutedListeners.forEach(listener => listener(_muted));
   
   if (value) {
     if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
     if (activePad) {
       activePad.masterGain.gain.cancelScheduledValues(activePad.ctx.currentTime);
       activePad.masterGain.gain.linearRampToValueAtTime(0, activePad.ctx.currentTime + 0.3);
     }
   } else {
     if (activePad) {
       activePad.masterGain.gain.cancelScheduledValues(activePad.ctx.currentTime);
       activePad.masterGain.gain.linearRampToValueAtTime(PAD_GAIN, activePad.ctx.currentTime + 0.6);
     }
   }
}

export function toggleMuted(): void {
   setMuted(!_muted);
}

export function subscribe(listener: (muted: boolean) => void): () => void {
   _mutedListeners.add(listener);
   // Call immediately with current state
   listener(_muted);
   return () => {
     _mutedListeners.delete(listener);
   };
}

// ── Selezione voce ─────────────────────────────────────────────────────
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

// ── speak() ────────────────────────────────────────────────────────────
export interface SpeakOptions {
  interrupt?: boolean;
  /** charIndex della parola corrente (evento onboundary nativo) */
  onBoundary?: (charIndex: number) => void;
  /** chiamato quando la lettura è completata */
  onEnd?: () => void;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (_muted) return;
  if (typeof speechSynthesis === "undefined" || !text.trim()) return;
  const { interrupt = true, onBoundary, onEnd } = opts;
  if (interrupt) speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang   = "it-IT";
  utter.pitch  = VOICE_PITCH;
  utter.rate   = VOICE_RATE;
  utter.volume = VOICE_VOLUME;

  if (onBoundary) {
    utter.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name === "word") onBoundary(e.charIndex);
    };
  }
  if (onEnd) utter.onend = () => onEnd();

  const doSpeak = () => {
    if (_muted) return;
    const v = pickItalianFemaleVoice();
    if (v) utter.voice = v;
    speechSynthesis.speak(utter);
  };

  if (!speechSynthesis.getVoices().length) {
    speechSynthesis.addEventListener("voiceschanged", doSpeak, { once: true });
  } else {
    doSpeak();
  }
}

export function stopSpeech(): void {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

// ── Ambient pad ────────────────────────────────────────────────────────
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
  if (!_muted) {
    masterGain.gain.linearRampToValueAtTime(PAD_GAIN, ctx.currentTime + 2);
  }
  activePad = { ctx, masterGain, oscillators, lfo, lfoGain };
}

export function stopAmbientPad(fadeSec = 2): void {
  if (!activePad) return;
  const { ctx, masterGain, oscillators, lfo } = activePad;
  activePad = null;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.linearRampToValueAtTime(0, now + fadeSec);
  setTimeout(() => {
    oscillators.forEach((o) => { try { o.stop(); } catch {} });
    try { lfo.stop(); } catch {}
    if (ctx.state !== "closed") {
      void ctx.close().catch(() => {});
    }
  }, fadeSec * 1000 + 100);
}
