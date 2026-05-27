import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "@/lib/motion";

/**
 * AnimatedBackdrop — premium ambient layer (NorthStar Design System v2).
 * Renders fixed behind everything (z-0). Three layers:
 *  1. Slow breathing gradient mesh (gold / blue / sage blobs)
 *  2. 50 deterministic dust particles drifting upward
 *  3. Diagonal gold sweep (like a slow radar)
 *  4. Static cardinal "N" watermark
 * All parallaxes gently with scroll. Respects prefers-reduced-motion.
 */
export function AnimatedBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        if (ref.current) {
          const y = window.scrollY;
          ref.current.style.setProperty("--scroll-mesh-a", `translate3d(0, ${-y * 0.12}px, 0)`);
          ref.current.style.setProperty("--scroll-mesh-b", `translate3d(0, ${-y * 0.20}px, 0)`);
          ref.current.style.setProperty("--scroll-mesh-c", `translate3d(0, ${-y * 0.30}px, 0)`);
          ref.current.style.setProperty("--scroll-cardinal", `translate3d(0, ${-y * 0.40}px, 0) rotate(${y * 0.04}deg)`);
        }
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [prefersReduced]);

  // Deterministic dust particles (seeded LCG so SSR-safe)
  const dust = useMemo(() => {
    const out: { x: number; y: number; size: number; dur: number; delay: number; drift: number; opacity: number }[] = [];
    let s = 19;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < 50; i++) {
      out.push({
        x: rnd() * 100,
        y: rnd() * 100,
        size: 1 + rnd() * 1.6,
        dur: 18 + rnd() * 26,
        delay: -rnd() * 30,
        drift: -8 + rnd() * 16,
        opacity: 0.15 + rnd() * 0.35,
      });
    }
    return out;
  }, []);

  return (
    <div ref={ref} className="ns-backdrop" aria-hidden="true">
      {/* Layer 1 — breathing gradient mesh */}
      <div className="ns-mesh">
        <span
          className="ns-mesh-a"
          style={{ transform: "var(--scroll-mesh-a, none)" }}
        />
        <span
          className="ns-mesh-b"
          style={{ transform: "var(--scroll-mesh-b, none)" }}
        />
        <span
          className="ns-mesh-c"
          style={{ transform: "var(--scroll-mesh-c, none)" }}
        />
      </div>

      {/* Layer 2 — dust particles drifting upward */}
      {!prefersReduced && (
        <div className="ns-dust">
          {dust.map((d, i) => (
            <span
              key={i}
              className="ns-particle"
              style={{
                left: `${d.x}%`,
                bottom: "-10%",
                width: `${d.size}px`,
                height: `${d.size}px`,
                opacity: d.opacity,
                animationDuration: `${d.dur}s`,
                animationDelay: `${d.delay}s`,
                // @ts-expect-error CSS custom property
                "--drift": `${d.drift}vw`,
              }}
            />
          ))}
        </div>
      )}

      {/* Layer 3 — diagonal gold sweep */}
      {!prefersReduced && <div className="ns-sweep" />}

      {/* Layer 4 — static cardinal N watermark */}
      <svg
        className="ns-cardinal"
        viewBox="0 0 200 200"
        aria-hidden="true"
        style={{ transform: "var(--scroll-cardinal, none)" }}
      >
        <g opacity="0.08">
          <circle cx="100" cy="100" r="80" fill="none" stroke="#c19e4a" strokeWidth="1" />
          <circle
            cx="100" cy="100" r="60"
            fill="none" stroke="#c19e4a" strokeWidth="0.5" strokeDasharray="2 4"
          />
          <line x1="100" y1="20" x2="100" y2="40" stroke="#c19e4a" strokeWidth="1.5" />
          <text
            x="100" y="14"
            textAnchor="middle"
            fontFamily="serif"
            fontStyle="italic"
            fontSize="14"
            fill="#c19e4a"
          >
            N
          </text>
        </g>
      </svg>
    </div>
  );
}
