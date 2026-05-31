import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AppAudioProvider,
  type AppAudioContextValue,
  useAppAudio,
} from "./AppAudioProvider";

type Snapshot = AppAudioContextValue["snapshot"];

function createEngine(overrides: { snapshot?: Partial<Snapshot> } = {}) {
  const listeners = new Set<(snapshot: AppAudioContextValue["snapshot"]) => void>();
  const snapshot: Snapshot = {
    activated: false,
    ambientActive: false,
    muted: false,
    ritualPlayed: false,
    supported: true,
    wendyRitualPlayedCount: 0,
    ...overrides.snapshot,
  };

  return {
    activate: vi.fn(() => {
      snapshot.activated = true;
      listeners.forEach((listener) => listener({ ...snapshot }));
    }),
    setMuted: vi.fn((muted: boolean) => {
      snapshot.muted = muted;
      listeners.forEach((listener) => listener({ ...snapshot }));
    }),
    playWendyRitual: vi.fn(() => {
      snapshot.wendyRitualPlayedCount += 1;
      listeners.forEach((listener) => listener({ ...snapshot }));
    }),
    subscribe: vi.fn((listener: (next: AppAudioContextValue["snapshot"]) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    getSnapshot: vi.fn(() => ({ ...snapshot })),
  };
}

function Probe() {
  const audio = useAppAudio();
  return (
    <div>
      <button type="button" onClick={() => audio.setMuted(!audio.snapshot.muted)}>
        {audio.snapshot.muted ? "Audio spento" : "Audio acceso"}
      </button>
      <button type="button" onClick={audio.playWendyRitual}>
        Apri Wendy
      </button>
    </div>
  );
}

describe("AppAudioProvider", () => {
  it("activates the audio engine on the first user gesture when sound is enabled", () => {
    const engine = createEngine();

    render(
      <AppAudioProvider engine={engine}>
        <Probe />
      </AppAudioProvider>,
    );

    expect(engine.activate).not.toHaveBeenCalled();

    fireEvent.pointerDown(window);

    expect(engine.activate).toHaveBeenCalledTimes(1);
  });

  it("does not activate the engine from a gesture when sound is muted", () => {
    const engine = createEngine({ snapshot: { muted: true } });

    render(
      <AppAudioProvider engine={engine}>
        <Probe />
      </AppAudioProvider>,
    );

    fireEvent.keyDown(window, { key: "Enter" });

    expect(engine.activate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Audio spento" })).toBeInTheDocument();
  });

  it("exposes global mute changes through context", () => {
    const engine = createEngine();

    render(
      <AppAudioProvider engine={engine}>
        <Probe />
      </AppAudioProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Audio acceso" }));

    expect(engine.setMuted).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Audio spento" })).toBeInTheDocument();
  });

  it("activates from the same user action that unmutes sound", () => {
    const engine = createEngine({ snapshot: { muted: true } });

    render(
      <AppAudioProvider engine={engine}>
        <Probe />
      </AppAudioProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Audio spento" }));

    expect(engine.setMuted).toHaveBeenCalledWith(false);
    expect(engine.activate).toHaveBeenCalledTimes(1);
  });

  it("exposes the Wendy ritual trigger through context", () => {
    const engine = createEngine();

    render(
      <AppAudioProvider engine={engine}>
        <Probe />
      </AppAudioProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Apri Wendy" }));

    expect(engine.playWendyRitual).toHaveBeenCalledTimes(1);
  });
});
