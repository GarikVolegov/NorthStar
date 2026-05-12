import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type AvatarState = "curious" | "reflective" | "focused" | "celebrating" | "speaking";

interface WendyAvatarProps {
  state: AvatarState;
  phase: 0 | 1 | 2;
  reduced?: boolean;
  className?: string;
  size?: number;
}

const PHASE_PALETTE = [
  { bg: "#EFF6FF", bgDark: "#1E3A5F", accent: "#3B82F6", skin: "#FDDCB5", hair: "#2D1B00" },
  { bg: "#F5F3FF", bgDark: "#2E1B5F", accent: "#7C3AED", skin: "#FDDCB5", hair: "#1A0A2E" },
  { bg: "#FFFBEB", bgDark: "#451A03", accent: "#D97706", skin: "#FDDCB5", hair: "#1C1008" },
] as const;

const MOUTH_PATHS: Record<AvatarState, string> = {
  curious:     "M 44 68 Q 50 72 56 68",
  reflective:  "M 44 69 Q 50 71 56 69",
  focused:     "M 44 67 Q 50 73 56 67",
  celebrating: "M 42 66 Q 50 76 58 66",
  speaking:    "M 42 68 Q 50 74 58 68",
};

const BROW_OFFSETS: Record<AvatarState, { lY: number; rY: number; lRotate: number; rRotate: number }> = {
  curious:     { lY: 0,  rY: -3, lRotate: 0,  rRotate: -8 },
  reflective:  { lY: 1,  rY: 1,  lRotate: 0,  rRotate: 0  },
  focused:     { lY: 0,  rY: 0,  lRotate: -3, rRotate: 3  },
  celebrating: { lY: -3, rY: -3, lRotate: 5,  rRotate: -5 },
  speaking:    { lY: -1, rY: -1, lRotate: 0,  rRotate: 0  },
};

const HEAD_TILT: Record<AvatarState, number> = {
  curious:     4,
  reflective:  0,
  focused:     0,
  celebrating: -5,
  speaking:    2,
};

export function WendyAvatar({ state, phase, reduced = false, className, size = 120 }: WendyAvatarProps) {
  const p = PHASE_PALETTE[phase];
  const brow = BROW_OFFSETS[state];
  const tilt = HEAD_TILT[state];

  return (
    <motion.div
      className={cn("relative flex items-center justify-center rounded-2xl overflow-hidden", className)}
      style={{ width: size, height: size, background: p.bg }}
      animate={reduced ? {} : { rotate: [0, tilt, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size * 0.82}
        height={size * 0.82}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="30" y="82" width="40" height="18" rx="8" fill={p.accent} opacity="0.18" />
        <rect x="38" y="75" width="24" height="14" rx="4" fill={p.skin} />
        <ellipse cx="50" cy="46" rx="22" ry="24" fill={p.skin} />
        <ellipse cx="50" cy="30" rx="22" ry="13" fill={p.hair} />
        <ellipse cx="72" cy="32" rx="7" ry="6" fill={p.hair} />
        <ellipse cx="75" cy="30" rx="4" ry="4" fill={p.hair} opacity="0.7" />
        <path d="M28 36 Q24 48 27 58" stroke={p.hair} strokeWidth="5" strokeLinecap="round" />
        <circle cx="28" cy="50" r="2" fill={p.accent} opacity="0.8" />
        <circle cx="72" cy="50" r="2" fill={p.accent} opacity="0.8" />
        <motion.line
          x1="39" y1={38 + brow.lY} x2="47" y2={38 + brow.lY + 0.5}
          stroke={p.hair} strokeWidth="1.8" strokeLinecap="round"
          animate={reduced ? {} : { y1: 38 + brow.lY, rotate: brow.lRotate }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
        <motion.line
          x1="53" y1={38 + brow.rY + 0.5} x2="61" y2={38 + brow.rY}
          stroke={p.hair} strokeWidth="1.8" strokeLinecap="round"
          animate={reduced ? {} : { y1: 38 + brow.rY, rotate: brow.rRotate }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
        <ellipse cx="42" cy="48" rx="5" ry={state === "reflective" ? 3.5 : 5} fill="white" />
        <ellipse cx="58" cy="48" rx="5" ry={state === "reflective" ? 3.5 : 5} fill="white" />
        <motion.circle cx="42" cy="48" r="3" fill={p.accent}
          animate={reduced ? {} : { cx: state === "curious" ? 43 : 42 }}
          transition={{ duration: 0.4 }}
        />
        <motion.circle cx="58" cy="48" r="3" fill={p.accent}
          animate={reduced ? {} : { cx: state === "curious" ? 59 : 58 }}
          transition={{ duration: 0.4 }}
        />
        <circle cx="42" cy="48" r="1.4" fill="#111" />
        <circle cx="58" cy="48" r="1.4" fill="#111" />
        <circle cx="43.5" cy="46.5" r="0.8" fill="white" opacity="0.9" />
        <circle cx="59.5" cy="46.5" r="0.8" fill="white" opacity="0.9" />
        <path d="M37 44 Q38 42 40 43" stroke={p.hair} strokeWidth="1" strokeLinecap="round" />
        <path d="M44 43 Q46 41.5 47 43" stroke={p.hair} strokeWidth="1" strokeLinecap="round" />
        <path d="M53 43 Q55 41.5 56 43" stroke={p.hair} strokeWidth="1" strokeLinecap="round" />
        <path d="M60 43 Q62 42 63 44" stroke={p.hair} strokeWidth="1" strokeLinecap="round" />
        <path d="M49 54 Q48 58 50 59 Q52 58 51 54" stroke={p.skin} strokeWidth="1.2" fill="none" opacity="0.5" />
        <motion.path
          d={MOUTH_PATHS[state]}
          stroke={p.hair} strokeWidth="1.8" strokeLinecap="round" fill="none"
          animate={reduced ? {} : { d: MOUTH_PATHS[state] }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
        />
        <motion.path
          d={MOUTH_PATHS[state].replace("Q", "q")}
          stroke={p.skin} strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.3"
          animate={reduced ? {} : { d: MOUTH_PATHS[state] }}
          transition={{ duration: 0.45 }}
        />
        {state === "celebrating" && (
          <>
            <ellipse cx="36" cy="56" rx="5" ry="3" fill={p.accent} opacity="0.18" />
            <ellipse cx="64" cy="56" rx="5" ry="3" fill={p.accent} opacity="0.18" />
          </>
        )}
        {state === "speaking" && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.rect
                key={i}
                x={30 + i * 6}
                y={56}
                width={3}
                height={8}
                rx={1.5}
                fill={p.accent}
                opacity={0.6}
                animate={reduced ? {} : { height: [6, 14, 6] }}
                transition={{ duration: 0.4 + i * 0.08, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
            {[0, 1, 2].map((i) => (
              <motion.rect
                key={`r-${i}`}
                x={67 + i * 6}
                y={56}
                width={3}
                height={8}
                rx={1.5}
                fill={p.accent}
                opacity={0.6}
                animate={reduced ? {} : { height: [6, 14, 6] }}
                transition={{ duration: 0.4 + i * 0.08, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </>
        )}
        <path d="M38 76 L44 83 L50 78 L56 83 L62 76" stroke={p.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <motion.div
        className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full"
        style={{ background: p.accent }}
        animate={reduced ? {} : { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: state === "speaking" ? 0.6 : 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

// Re-export con vecchio nome per compatibilità backward con altri componenti
export { WendyAvatar as LyraAvatar };
export type { WendyAvatarProps as LyraAvatarProps };
