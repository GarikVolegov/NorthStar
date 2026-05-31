/**
 * wendy-sound.ts — Wendy's entry chime.
 *
 * A short, JARVIS-like rising shimmer synthesized on the fly with the Web Audio
 * API (no binary asset to ship). Played when the user opens Wendy.
 *
 * Design goals:
 *  - SSR-safe: never touches `window` at module scope.
 *  - Best-effort: any failure is swallowed; it must NEVER block interaction.
 *  - User gesture only: call it from a click/keydown handler so the browser
 *    autoplay policy lets the AudioContext start.
 *  - Opt-out: respects the `wendy:sound` localStorage flag.
 */

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

export function isWendySoundEnabled(): boolean {
  try {
    return localStorage.getItem("wendy:sound") !== "off";
  } catch {
    return true;
  }
}

export function setWendySoundEnabled(on: boolean): void {
  try {
    localStorage.setItem("wendy:sound", on ? "on" : "off");
  } catch {
    /* localStorage unavailable — ignore */
  }
}

/**
 * Play the entry chime: two rising, slightly detuned voices through a sweeping
 * low-pass filter — a soft futuristic "power-up" reminiscent of JARVIS.
 */
export function playWendyEntryChime(): void {
  if (!isWendySoundEnabled()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;

    // Master envelope: quick attack, gentle decay (~0.55s).
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.13, now + 0.06);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    // Low-pass sweep opens up → the "brightening" shimmer.
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(700, now);
    lp.frequency.exponentialRampToValueAtTime(5200, now + 0.4);

    master.connect(lp).connect(ctx.destination);

    // [startHz, endHz, waveform, voiceGain]
    const voices: Array<[number, number, OscillatorType, number]> = [
      [392, 784, "triangle", 0.9], // G4 → G5, the body
      [587, 1175, "sine", 0.45], // D5 → D6, airy shimmer
    ];

    for (const [f0, f1, type, gain] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(f1, now + 0.38);

      const vg = ctx.createGain();
      vg.gain.value = gain;

      osc.connect(vg).connect(master);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch {
    /* audio is best-effort; never block the interaction */
  }
}
