import { useAuth } from "@/contexts/AuthContext";
import { normalizeBackgroundAppearance } from "@/features/user-background/types";
import { useUserBackground } from "@/hooks/useUserBackground";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function useIsSmallViewport() {
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(max-width: 767px)");
    setIsSmall(query.matches);
    const listener = (event: MediaQueryListEvent) => setIsSmall(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return isSmall;
}

export function UserBackgroundLayer() {
  const { user } = useAuth();
  const { activeBackground, appearance: rawAppearance } = useUserBackground(user?.id ?? null);
  const isSmall = useIsSmallViewport();
  const appearance = normalizeBackgroundAppearance(rawAppearance);
  const imageLuma = activeBackground?.kind === "user" ? activeBackground.entry.luma : undefined;
  const autoAlpha =
    appearance.mode === "auto" && typeof imageLuma === "number"
      ? imageLuma > 0.62
        ? 0.78
        : imageLuma < 0.32
          ? 0.66
          : appearance.glassOpacity
      : appearance.glassOpacity;

  useEffect(() => {
    const root = document.documentElement;
    if (!user || !activeBackground) {
      root.removeAttribute("data-user-background");
      root.style.removeProperty("--app-glass-alpha");
      root.style.removeProperty("--app-glass-blur");
      root.style.removeProperty("--app-glass-saturation");
      root.style.removeProperty("--app-bg-overlay");
      return;
    }
    root.setAttribute("data-user-background", "active");
    root.style.setProperty("--app-glass-alpha", String(autoAlpha));
    root.style.setProperty("--app-glass-blur", `${appearance.blur}px`);
    root.style.setProperty("--app-glass-saturation", String(appearance.saturation));
    // Store as a plain number (0–1) — consumed via hsl(var(--background) / var(--app-bg-overlay))
    root.style.setProperty("--app-bg-overlay", String(appearance.overlay));
    return () => {
      root.removeAttribute("data-user-background");
      root.style.removeProperty("--app-glass-alpha");
      root.style.removeProperty("--app-glass-blur");
      root.style.removeProperty("--app-glass-saturation");
      root.style.removeProperty("--app-bg-overlay");
    };
  }, [activeBackground, appearance.blur, appearance.overlay, appearance.saturation, autoAlpha, user]);

  if (!user || !activeBackground) return null;

  if (activeBackground.kind === "preset") {
    return (
      <div
        data-testid="user-background-layer"
        aria-hidden="true"
        className={cn("pointer-events-none fixed inset-0 z-0", activeBackground.preset.overlayClassName)}
      />
    );
  }

  const image = isSmall
    ? activeBackground.entry.dataUrlMobile
    : activeBackground.entry.dataUrl;
  const position = isSmall ? appearance.mobilePosition : appearance.desktopPosition;

  return (
    <div
      data-testid="user-background-layer"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 bg-cover bg-no-repeat"
      style={{ backgroundImage: `url(${image})`, backgroundPosition: position }}
    >
      {/* Overlay: tints the image to improve readability — inline style avoids Tailwind CSS-var opacity issues */}
      <div
        className="absolute inset-0 backdrop-blur-[1px]"
        style={{ backgroundColor: `hsl(var(--background) / var(--app-bg-overlay, 0.32))` }}
      />
    </div>
  );
}
