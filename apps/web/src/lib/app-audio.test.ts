import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUDIO_MUTED_STORAGE_KEY,
  BACKGROUND_SOUNDTRACK,
  WENDY_OPENING_RITUAL,
  createAppAudioEngine,
} from "./app-audio";

type AudioParamCall = [method: string, value: number, time: number];

const maxScheduledValue = (
  gains: Array<ReturnType<typeof createAudioParamMock>>,
) => Math.max(...gains.flatMap((gain) => gain.calls.map(([, value]) => value)));

function createAudioParamMock(initial = 0) {
  const calls: AudioParamCall[] = [];
  return {
    calls,
    value: initial,
    cancelScheduledValues: vi.fn((time: number) => {
      calls.push(["cancelScheduledValues", 0, time]);
    }),
    setValueAtTime: vi.fn((value: number, time: number) => {
      calls.push(["setValueAtTime", value, time]);
    }),
    linearRampToValueAtTime: vi.fn((value: number, time: number) => {
      calls.push(["linearRampToValueAtTime", value, time]);
    }),
    exponentialRampToValueAtTime: vi.fn((value: number, time: number) => {
      calls.push(["exponentialRampToValueAtTime", value, time]);
    }),
    setTargetAtTime: vi.fn((value: number, time: number) => {
      calls.push(["setTargetAtTime", value, time]);
    }),
  };
}

function createStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };
}

function createAudioWindow(initialStorage: Record<string, string> = {}) {
  const createdContexts: Array<{
    ctx: AudioContext;
    masterGains: Array<ReturnType<typeof createAudioParamMock>>;
    oscillatorStarts: number[];
    oscillatorStops: number[];
    oscillatorFrequencies: Array<ReturnType<typeof createAudioParamMock>>;
    oscillatorTypes: string[];
  }> = [];
  const storage = createStorage(initialStorage);

  class MockAudioContext {
    currentTime = 10;
    state: AudioContextState = "running";
    destination = {};
    masterGains: Array<ReturnType<typeof createAudioParamMock>> = [];
    oscillatorStarts: number[] = [];
    oscillatorStops: number[] = [];
    oscillatorFrequencies: Array<ReturnType<typeof createAudioParamMock>> = [];
    oscillatorTypes: string[] = [];

    constructor() {
      createdContexts.push({
        ctx: this as unknown as AudioContext,
        masterGains: this.masterGains,
        oscillatorStarts: this.oscillatorStarts,
        oscillatorStops: this.oscillatorStops,
        oscillatorFrequencies: this.oscillatorFrequencies,
        oscillatorTypes: this.oscillatorTypes,
      });
    }

    createGain() {
      const gain = createAudioParamMock(0);
      this.masterGains.push(gain);
      return {
        gain,
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }

    createOscillator() {
      const frequency = createAudioParamMock(440);
      const detune = createAudioParamMock(0);
      const context = this;
      this.oscillatorFrequencies.push(frequency);
      return {
        get type() {
          return context.oscillatorTypes[context.oscillatorTypes.length - 1] ?? "sine";
        },
        set type(value: string) {
          context.oscillatorTypes.push(value);
        },
        frequency,
        detune,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn((time?: number) => this.oscillatorStarts.push(time ?? this.currentTime)),
        stop: vi.fn((time?: number) => this.oscillatorStops.push(time ?? this.currentTime)),
      };
    }

    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: createAudioParamMock(800),
        Q: createAudioParamMock(0),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }

    createDelay() {
      return {
        delayTime: createAudioParamMock(0),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }

    resume = vi.fn(() => Promise.resolve());
    close = vi.fn(() => Promise.resolve());
  }

  const win = {
    AudioContext: MockAudioContext,
    localStorage: storage,
  } as unknown as Window;

  return { createdContexts, storage, win };
}

describe("app audio engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("does not create an AudioContext before activation", () => {
    const { createdContexts, win } = createAudioWindow();

    createAppAudioEngine({ window: win });

    expect(createdContexts).toHaveLength(0);
  });

  it("plays the opening ritual once and starts the ambient pad after activation", () => {
    const { createdContexts, win } = createAudioWindow();
    const engine = createAppAudioEngine({ window: win });

    engine.activate();

    expect(createdContexts).toHaveLength(1);
    const firstStartCount = createdContexts[0]?.oscillatorStarts.length ?? 0;
    expect(firstStartCount).toBeGreaterThan(0);
    expect(engine.getSnapshot()).toMatchObject({
      activated: true,
      ambientActive: true,
      ritualPlayed: true,
      muted: false,
    });

    engine.activate();

    expect(createdContexts).toHaveLength(1);
    expect(createdContexts[0]?.oscillatorStarts).toHaveLength(firstStartCount);
  });

  it("treats direct ambient starts as full activation so the ritual is not skipped", () => {
    const { createdContexts, win } = createAudioWindow();
    const engine = createAppAudioEngine({ window: win });

    engine.startAmbient();

    expect(createdContexts).toHaveLength(1);
    expect(engine.getSnapshot()).toMatchObject({
      activated: true,
      ambientActive: true,
      ritualPlayed: true,
    });
    expect(createdContexts[0]?.oscillatorStarts.length).toBeGreaterThan(5);
  });

  it("uses the cinematic 90 BPM D minor background soundtrack", () => {
    const { createdContexts, win } = createAudioWindow();
    const engine = createAppAudioEngine({ window: win });

    engine.activate();

    const scheduledFrequencies = createdContexts[0]?.oscillatorFrequencies
      .flatMap((frequency) => frequency.calls.map(([, value]) => Number(value.toFixed(2)))) ?? [];

    expect(BACKGROUND_SOUNDTRACK).toMatchObject({
      bpm: 90,
      key: "D minor",
      mood: "dark-futuristic",
    });
    expect(scheduledFrequencies).toEqual(expect.arrayContaining([36.71, 73.42, 146.83, 174.61]));
    expect(createdContexts[0]?.oscillatorStarts.some((time) => time >= 10 && time <= 10.08)).toBe(true);
    expect(createdContexts[0]?.oscillatorStarts.some((time) => time >= 16)).toBe(true);
  });


  it("keeps the app opening ritual audibly above the ambient pad", () => {
    const { createdContexts, win } = createAudioWindow();
    const engine = createAppAudioEngine({ window: win });

    engine.activate();

    const gains = createdContexts[0]?.masterGains ?? [];
    expect(maxScheduledValue(gains)).toBeGreaterThanOrEqual(0.85);
    expect(gains.some((gain) => gain.calls.some(([, value]) => value >= 0.09))).toBe(true);
  });

  it("plays a distinct Wendy ritual without replaying the app opening ritual", () => {
    const { createdContexts, win } = createAudioWindow();
    const engine = createAppAudioEngine({ window: win });

    engine.activate();
    const afterAppOpenStartCount = createdContexts[0]?.oscillatorStarts.length ?? 0;

    engine.playWendyRitual();

    expect(createdContexts).toHaveLength(1);
    expect(createdContexts[0]?.oscillatorStarts.length).toBeGreaterThan(afterAppOpenStartCount);
    expect(engine.getSnapshot()).toMatchObject({
      activated: true,
      ritualPlayed: true,
      wendyRitualPlayedCount: 1,
    });
  });

  it("uses an epic cinematic reveal impact when Wendy opens", () => {
    const { createdContexts, win } = createAudioWindow();
    const engine = createAppAudioEngine({ window: win });

    engine.activate();
    const frequencyCountAfterActivation = createdContexts[0]?.oscillatorFrequencies.length ?? 0;
    const gainCountAfterActivation = createdContexts[0]?.masterGains.length ?? 0;

    engine.playWendyRitual();

    const wendyFrequencies = createdContexts[0]?.oscillatorFrequencies
      .slice(frequencyCountAfterActivation)
      .flatMap((frequency) => frequency.calls.map(([, value]) => Number(value.toFixed(2)))) ?? [];
    const wendyGains = createdContexts[0]?.masterGains.slice(gainCountAfterActivation) ?? [];
    const wendyStarts = createdContexts[0]?.oscillatorStarts.slice(frequencyCountAfterActivation) ?? [];

    expect(WENDY_OPENING_RITUAL).toMatchObject({
      style: "epic-cinematic-reveal",
      impact: "table-slam-boom",
      mood: "mysterious-suspense",
    });
    expect(wendyFrequencies).toEqual(expect.arrayContaining([36.71, 55, 73.42, 1760]));
    expect(maxScheduledValue(wendyGains)).toBeGreaterThanOrEqual(0.88);
    expect(wendyStarts.some((time) => time >= 10 && time <= 10.05)).toBe(true);
    expect(wendyStarts.some((time) => time >= 11.75)).toBe(true);
  });

  it("queues the Wendy ritual instead of creating AudioContext before activation", () => {
    const { createdContexts, win } = createAudioWindow();
    const engine = createAppAudioEngine({ window: win });

    engine.playWendyRitual();

    expect(createdContexts).toHaveLength(0);
    expect(engine.getSnapshot()).toMatchObject({
      activated: false,
      wendyRitualPlayedCount: 0,
    });

    engine.activate();

    expect(createdContexts).toHaveLength(1);
    expect(engine.getSnapshot()).toMatchObject({
      activated: true,
      wendyRitualPlayedCount: 1,
    });
  });


  it("keeps the Wendy ritual clearly audible over the ambient pad", () => {
    const { createdContexts, win } = createAudioWindow();
    const engine = createAppAudioEngine({ window: win });

    engine.activate();
    const gainCountAfterActivation = createdContexts[0]?.masterGains.length ?? 0;

    engine.playWendyRitual();

    const wendyGains = createdContexts[0]?.masterGains.slice(gainCountAfterActivation) ?? [];
    expect(maxScheduledValue(wendyGains)).toBeGreaterThanOrEqual(0.72);
    expect(wendyGains.some((gain) => gain.calls.some(([, value]) => value >= 0.08))).toBe(true);
  });

  it("fades the ambient pad out when muted and persists the preference", () => {
    const { createdContexts, storage, win } = createAudioWindow();
    const engine = createAppAudioEngine({ window: win });

    engine.activate();
    engine.setMuted(true);

    expect(storage.setItem).toHaveBeenCalledWith(AUDIO_MUTED_STORAGE_KEY, "1");
    expect(engine.getSnapshot()).toMatchObject({ muted: true, ambientActive: false });
    const rampCalls = createdContexts[0]?.masterGains.flatMap((gain) => gain.calls) ?? [];
    expect(rampCalls).toContainEqual(["linearRampToValueAtTime", 0, 10.8]);
  });

  it("does not activate audio when the persisted preference is muted", () => {
    const { createdContexts, win } = createAudioWindow({
      [AUDIO_MUTED_STORAGE_KEY]: "1",
    });
    const engine = createAppAudioEngine({ window: win });

    engine.activate();

    expect(createdContexts).toHaveLength(0);
    expect(engine.getSnapshot()).toMatchObject({ muted: true, activated: false });
  });

  it("is a safe no-op when Web Audio is unsupported", () => {
    const storage = createStorage();
    const engine = createAppAudioEngine({
      window: { localStorage: storage } as unknown as Window,
    });

    expect(() => engine.activate()).not.toThrow();
    expect(() => engine.setMuted(true)).not.toThrow();
    expect(engine.getSnapshot()).toMatchObject({ supported: false, muted: true });
  });
});
