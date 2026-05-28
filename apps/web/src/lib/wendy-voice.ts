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

import { appAudio } from "@/lib/app-audio";

const VOICE_PITCH  = 1.12;
const VOICE_RATE   = 0.88;
const VOICE_VOLUME = 1.0;

// ── Stato mute globale ─────────────────────────────────────────────────
let _muted = appAudio.getSnapshot().muted;
const _mutedListeners: Set<(muted: boolean) => void> = new Set();

appAudio.subscribe((snapshot) => {
   if (_muted === snapshot.muted) return;
   _muted = snapshot.muted;
   _mutedListeners.forEach(listener => listener(_muted));
   if (_muted && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
});

export function isMuted(): boolean { return _muted; }
export const getMuted = isMuted; // Alias for backward compatibility

export function setMuted(value: boolean): void {
   if (_muted === value) return;
   appAudio.setMuted(value);
   if (value && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
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
export function startAmbientPad(): void {
  appAudio.startAmbient();
}

export function stopAmbientPad(fadeSec = 2): void {
  appAudio.stopAmbient(fadeSec);
}
