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

const PHASE_CONFIG = [
  { bg1: "#1E3A5F", bg2: "#2A4F7F", accent: "#60A5FA", ring: "#3B82F6" },
  { bg1: "#2E1B5F", bg2: "#4A2F8F", accent: "#A78BFA", ring: "#8B5CF6" },
  { bg1: "#451A03", bg2: "#6B2A0A", accent: "#FBBF24", ring: "#F59E0B" },
] as const;

export function WendyAvatar({ state, phase, reduced = false, className, size = 120 }: WendyAvatarProps) {
  const p = PHASE_CONFIG[phase];

  return (
    <motion.div
      data-testid="wendy-avatar"
      data-state={state}
      className={cn(
        "relative flex items-center justify-center rounded-full overflow-hidden",
        "shadow-lg ring-1 ring-white/10",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${p.bg1}, ${p.bg2})`,
      }}
      animate={reduced ? {} : {
        boxShadow: [
          `0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)`,
          state === "speaking"
            ? `0 4px 20px ${p.ring}66, inset 0 1px 0 rgba(255,255,255,0.08)`
            : `0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)`,
          `0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)`,
        ],
      }}
      transition={{ duration: 1.5, repeat: state === "speaking" ? Infinity : 0, ease: "easeInOut" }}
    >
      {state === "speaking" && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: `2px solid ${p.accent}`, boxShadow: `inset 0 0 12px ${p.accent}44` }}
          animate={reduced ? {} : { opacity: [0.2, 0.6, 0.2], scale: [1, 1.04, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {state === "celebrating" && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 50%, ${p.accent}44 0%, transparent 70%)` }}
          animate={reduced ? {} : { opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {state === "curious" && !reduced && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: `1.5px solid ${p.accent}33` }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <svg
        viewBox="0 0 100 100"
        width={size * 0.68}
        height={size * 0.68}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <ellipse cx="50" cy="33" rx="12" ry="13.5" fill="white" />
        <path
          d="M38 33 C38 22 62 22 62 33 C62 42 57 47 54 48 L54 40 C51 42 49 42 46 40 L46 48 C43 47 38 42 38 33Z"
          fill="white"
          opacity="0.4"
        />
        <path
          d="M35 44 C35 40 39 38 43 38 L57 38 C61 38 65 40 65 44 L67 88 L33 88Z"
          fill="white"
          opacity="0.88"
        />
        <path
          d="M47 38 L50 49 L53 38"
          stroke={p.accent}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      </svg>

      <motion.div
        className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white/80"
        style={{ background: p.accent }}
        animate={reduced ? {} : {
          scale: [1, 1.3, 1],
          opacity: [1, 0.5, 1],
        }}
        transition={{
          duration: state === "speaking" ? 0.8 : 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}

export { WendyAvatar as LyraAvatar };
export type { WendyAvatarProps as LyraAvatarProps };
