export const AUDIO_MUTED_STORAGE_KEY = "northstar_audio_muted";

const AMBIENT_GAIN = 0.016;
const RITUAL_DURATION_SEC = 1.7;

export const BACKGROUND_SOUNDTRACK = {
  bpm: 90,
  key: "D minor",
  mood: "dark-futuristic",
  beatSec: 60 / 90,
  loopBeats: 16,
  rootHz: 36.71,
  notesHz: {
    d1: 36.71,
    a1: 55,
    d2: 73.42,
    a2: 110,
    d3: 146.83,
    f3: 174.61,
    a3: 220,
    d4: 293.66,
  },
} as const;

export const WENDY_OPENING_RITUAL = {
  style: "epic-cinematic-reveal",
  impact: "table-slam-boom",
  mood: "mysterious-suspense",
  durationSec: 2.35,
  key: "D minor",
  rootHz: BACKGROUND_SOUNDTRACK.notesHz.d1,
  finalBoomHz: BACKGROUND_SOUNDTRACK.notesHz.a1,
} as const;

export interface AppAudioSnapshot {
  activated: boolean;
  ambientActive: boolean;
  muted: boolean;
  ritualPlayed: boolean;
  supported: boolean;
  wendyRitualPlayedCount: number;
}

export interface AppAudioEngine {
  activate: () => void;
  playWendyRitual: () => void;
  startAmbient: () => void;
  stopAmbient: (fadeSec?: number) => void;
  setMuted: (muted: boolean) => void;
  getSnapshot: () => AppAudioSnapshot;
  subscribe: (listener: (snapshot: AppAudioSnapshot) => void) => () => void;
}

interface AmbientNodes {
  gain: GainNode;
  oscillators: OscillatorNode[];
  lfo: OscillatorNode;
  lfoGain: GainNode;
  pulseTimer: ReturnType<typeof setInterval> | null;
}

interface CreateAppAudioEngineOptions {
  window?: Window;
}

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function readMuted(win: Window | undefined) {
  try {
    return win?.localStorage?.getItem(AUDIO_MUTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(win: Window | undefined, muted: boolean) {
  try {
    win?.localStorage?.setItem(AUDIO_MUTED_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Storage can be unavailable in private contexts.
  }
}

function getAudioContextCtor(win: Window | undefined): typeof AudioContext | null {
  if (!win) return null;
  const audioWindow = win as AudioWindow;
  return (
    (audioWindow as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    audioWindow.webkitAudioContext ??
    null
  );
}

export function createAppAudioEngine(
  options: CreateAppAudioEngineOptions = {},
): AppAudioEngine {
  const win =
    options.window ?? (typeof window !== "undefined" ? window : undefined);
  const AudioCtx = getAudioContextCtor(win);
  const supported = !!AudioCtx;
  const listeners = new Set<(snapshot: AppAudioSnapshot) => void>();

  let ctx: AudioContext | null = null;
  let ambient: AmbientNodes | null = null;
  let activated = false;
  let muted = readMuted(win);
  let ritualPlayed = false;
  let pendingWendyRitual = false;
  let wendyRitualPlayedCount = 0;

  const getSnapshot = (): AppAudioSnapshot => ({
    activated,
    ambientActive: !!ambient,
    muted,
    ritualPlayed,
    supported,
    wendyRitualPlayedCount,
  });

  const notify = () => {
    const snapshot = getSnapshot();
    listeners.forEach((listener) => listener(snapshot));
  };

  const getContext = (): AudioContext | null => {
    if (!AudioCtx || muted) return null;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  };

  const scheduleTone = (
    audioCtx: AudioContext,
    destination: AudioNode,
    frequency: number,
    startOffset: number,
    duration: number,
    peakGain: number,
    type: OscillatorType = "sine",
  ) => {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now + startOffset);
    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.04);
  };

  const scheduleSubPulse = (
    audioCtx: AudioContext,
    destination: AudioNode,
    frequency: number,
    startOffset: number,
    duration: number,
    peakGain: number,
    type: OscillatorType = "triangle",
  ) => {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.type = type;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(140, now + startOffset);
    filter.frequency.exponentialRampToValueAtTime(58, now + startOffset + duration);
    filter.Q.setValueAtTime(1.4, now + startOffset);
    osc.frequency.setValueAtTime(frequency, now + startOffset);
    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.05);
  };

  const scheduleSweepTone = (
    audioCtx: AudioContext,
    destination: AudioNode,
    startFrequency: number,
    endFrequency: number,
    startOffset: number,
    duration: number,
    peakGain: number,
    type: OscillatorType = "sawtooth",
  ) => {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFrequency, now + startOffset);
    osc.frequency.exponentialRampToValueAtTime(endFrequency, now + startOffset + duration);
    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.04);
  };

  const playOpeningRitual = (audioCtx: AudioContext) => {
    const master = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    const delay = audioCtx.createDelay();
    const delayGain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.9, now + 0.16);
    master.gain.linearRampToValueAtTime(0.001, now + RITUAL_DURATION_SEC);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(640, now);
    filter.frequency.linearRampToValueAtTime(2600, now + 0.72);
    filter.frequency.linearRampToValueAtTime(900, now + RITUAL_DURATION_SEC);
    filter.Q.setValueAtTime(0.8, now);
    delay.delayTime.setValueAtTime(0.18, now);
    delayGain.gain.setValueAtTime(0.12, now);

    master.connect(filter);
    filter.connect(audioCtx.destination);
    filter.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(audioCtx.destination);

    [
      [220, 0, 0.58, 0.095, "sine"],
      [277.18, 0.12, 0.62, 0.086, "triangle"],
      [329.63, 0.27, 0.65, 0.078, "sine"],
      [440, 0.46, 0.72, 0.066, "triangle"],
      [554.37, 0.72, 0.68, 0.048, "sine"],
    ].forEach(([freq, offset, duration, gain, type]) => {
      scheduleTone(
        audioCtx,
        master,
        Number(freq),
        Number(offset),
        Number(duration),
        Number(gain),
        type as OscillatorType,
      );
    });

    [1320, 1661.22, 1760].forEach((freq, index) => {
      scheduleTone(audioCtx, master, freq, 0.5 + index * 0.1, 0.52, 0.018, "sine");
    });
  };

  const scheduleWendyRitual = (audioCtx: AudioContext, baseOffset = 0) => {
    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    const delay = audioCtx.createDelay();
    const delayGain = audioCtx.createGain();

    master.gain.setValueAtTime(0.0001, now + baseOffset);
    master.gain.exponentialRampToValueAtTime(0.92, now + baseOffset + 0.035);
    master.gain.exponentialRampToValueAtTime(0.38, now + baseOffset + 1.35);
    master.gain.exponentialRampToValueAtTime(0.0001, now + baseOffset + WENDY_OPENING_RITUAL.durationSec);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(180, now + baseOffset);
    filter.frequency.exponentialRampToValueAtTime(2200, now + baseOffset + 1.58);
    filter.frequency.exponentialRampToValueAtTime(520, now + baseOffset + WENDY_OPENING_RITUAL.durationSec);
    filter.Q.setValueAtTime(1.35, now + baseOffset);
    delay.delayTime.setValueAtTime(0.14, now + baseOffset);
    delayGain.gain.setValueAtTime(0.17, now + baseOffset);

    master.connect(filter);
    filter.connect(audioCtx.destination);
    filter.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(audioCtx.destination);

    scheduleSubPulse(audioCtx, master, WENDY_OPENING_RITUAL.rootHz, baseOffset, 1.1, 0.18, "sawtooth");
    scheduleSubPulse(audioCtx, master, BACKGROUND_SOUNDTRACK.notesHz.d2, baseOffset + 0.04, 0.82, 0.11, "triangle");
    scheduleTone(audioCtx, master, BACKGROUND_SOUNDTRACK.notesHz.d3, baseOffset + 0.02, 0.28, 0.075, "triangle");

    scheduleSweepTone(audioCtx, master, 1760, 3520, baseOffset + 0.18, 1.28, 0.035, "sawtooth");
    scheduleSweepTone(audioCtx, master, 880, 1760, baseOffset + 0.42, 1.05, 0.025, "square");
    scheduleSweepTone(audioCtx, master, BACKGROUND_SOUNDTRACK.notesHz.f3, BACKGROUND_SOUNDTRACK.notesHz.d4, baseOffset + 0.36, 1.18, 0.038, "triangle");

    [
      [BACKGROUND_SOUNDTRACK.notesHz.a2, 0.58, 0.08, 0.035, "square"],
      [BACKGROUND_SOUNDTRACK.notesHz.d4, 0.82, 0.07, 0.03, "square"],
      [BACKGROUND_SOUNDTRACK.notesHz.a3, 1.04, 0.06, 0.026, "square"],
      [BACKGROUND_SOUNDTRACK.notesHz.d4, 1.24, 0.05, 0.024, "square"],
    ].forEach(([freq, offset, duration, gain, type]) => {
      scheduleTone(audioCtx, master, Number(freq), baseOffset + Number(offset), Number(duration), Number(gain), type as OscillatorType);
    });

    scheduleSubPulse(audioCtx, master, WENDY_OPENING_RITUAL.finalBoomHz, baseOffset + 1.74, 0.62, 0.16, "sawtooth");
    scheduleSubPulse(audioCtx, master, BACKGROUND_SOUNDTRACK.notesHz.d2, baseOffset + 1.82, 0.5, 0.13, "triangle");
    scheduleTone(audioCtx, master, BACKGROUND_SOUNDTRACK.notesHz.d3, baseOffset + 1.78, 0.18, 0.08, "triangle");

    wendyRitualPlayedCount += 1;
    notify();
  };

  const playWendyRitual = () => {
    if (muted) return;
    if (!activated) {
      pendingWendyRitual = true;
      notify();
      return;
    }

    const audioCtx = getContext();
    if (!audioCtx) return;
    pendingWendyRitual = false;
    scheduleWendyRitual(audioCtx);
  };

  const startAmbientNodes = () => {
    if (ambient || muted) return;
    const audioCtx = getContext();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.linearRampToValueAtTime(520, now + BACKGROUND_SOUNDTRACK.beatSec * 8);
    filter.Q.setValueAtTime(0.9, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(AMBIENT_GAIN, now + BACKGROUND_SOUNDTRACK.beatSec * 6);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.035, now);
    lfoGain.gain.setValueAtTime(AMBIENT_GAIN * 0.28, now);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start(now);

    const oscillators = [
      [BACKGROUND_SOUNDTRACK.notesHz.d2, -7, "sine"],
      [BACKGROUND_SOUNDTRACK.notesHz.a2, 3, "triangle"],
      [BACKGROUND_SOUNDTRACK.notesHz.d3, -4, "sine"],
      [BACKGROUND_SOUNDTRACK.notesHz.f3, 5, "triangle"],
      [BACKGROUND_SOUNDTRACK.notesHz.a3, -6, "sine"],
      [BACKGROUND_SOUNDTRACK.notesHz.d4, 2, "triangle"],
    ].map(([frequency, detune, type]) => {
      const osc = audioCtx.createOscillator();
      osc.type = type as OscillatorType;
      osc.frequency.setValueAtTime(Number(frequency), now);
      osc.detune.setValueAtTime(Number(detune), now);
      osc.connect(filter);
      osc.start(now);
      return osc;
    });

    const scheduleCinematicLoop = () => {
      if (!ambient || !ctx) return;
      const beat = BACKGROUND_SOUNDTRACK.beatSec;

      scheduleSubPulse(audioCtx, filter, BACKGROUND_SOUNDTRACK.notesHz.d1, 0, beat * 3.2, 0.045, "sawtooth");
      scheduleSubPulse(audioCtx, filter, BACKGROUND_SOUNDTRACK.notesHz.a1, beat * 0.75, beat * 2.4, 0.028, "triangle");
      scheduleSubPulse(audioCtx, filter, BACKGROUND_SOUNDTRACK.notesHz.d2, beat * 1.5, beat * 2.1, 0.025, "sawtooth");

      [2, 3.5, 5, 6.5, 8.5, 10, 11.5, 13].forEach((beatOffset, index) => {
        scheduleTone(
          audioCtx,
          filter,
          index % 3 === 0 ? BACKGROUND_SOUNDTRACK.notesHz.d4 : BACKGROUND_SOUNDTRACK.notesHz.a3,
          beat * beatOffset,
          0.055,
          0.0065,
          "square",
        );
      });

      [6, 8, 10, 12].forEach((beatOffset, index) => {
        scheduleTone(
          audioCtx,
          filter,
          index % 2 === 0 ? BACKGROUND_SOUNDTRACK.notesHz.f3 : BACKGROUND_SOUNDTRACK.notesHz.d3,
          beat * beatOffset,
          beat * 1.8,
          0.012 + index * 0.002,
          "triangle",
        );
      });

      [14, 14.75, 15.25].forEach((beatOffset, index) => {
        scheduleSubPulse(
          audioCtx,
          filter,
          index === 1 ? BACKGROUND_SOUNDTRACK.notesHz.a1 : BACKGROUND_SOUNDTRACK.notesHz.d2,
          beat * beatOffset,
          0.16,
          0.02,
          "triangle",
        );
      });
    };

    ambient = { gain, oscillators, lfo, lfoGain, pulseTimer: null };
    scheduleCinematicLoop();
    ambient.pulseTimer = setInterval(
      scheduleCinematicLoop,
      BACKGROUND_SOUNDTRACK.beatSec * BACKGROUND_SOUNDTRACK.loopBeats * 1000,
    );
    notify();
  };

  const startAmbient = () => {
    if (ambient || muted) return;
    if (!activated) {
      activate();
      return;
    }

    startAmbientNodes();
  };

  const stopAmbient = (fadeSec = 0.8) => {
    if (!ambient || !ctx) return;
    const nodes = ambient;
    ambient = null;
    const now = ctx.currentTime;
    if (nodes.pulseTimer) clearInterval(nodes.pulseTimer);
    nodes.gain.gain.cancelScheduledValues(now);
    nodes.gain.gain.linearRampToValueAtTime(0, now + fadeSec);
    nodes.oscillators.forEach((osc) => {
      try {
        osc.stop(now + fadeSec + 0.05);
      } catch {
        osc.disconnect();
      }
    });
    try {
      nodes.lfo.stop(now + fadeSec + 0.05);
    } catch {
      nodes.lfo.disconnect();
    }
    notify();
  };

  const activate = () => {
    if (activated || muted) return;
    const audioCtx = getContext();
    if (!audioCtx) return;

    activated = true;
    if (!ritualPlayed) {
      ritualPlayed = true;
      playOpeningRitual(audioCtx);
    }
    startAmbientNodes();
    if (pendingWendyRitual) {
      pendingWendyRitual = false;
      scheduleWendyRitual(audioCtx, ritualPlayed ? 1.05 : 0);
    }
    notify();
  };

  const setMuted = (nextMuted: boolean) => {
    if (muted === nextMuted) return;
    muted = nextMuted;
    writeMuted(win, muted);
    if (muted) {
      stopAmbient(0.8);
    } else if (activated) {
      startAmbient();
    }
    notify();
  };

  return {
    activate,
    getSnapshot,
    playWendyRitual,
    setMuted,
    startAmbient,
    stopAmbient,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const appAudio = createAppAudioEngine();
