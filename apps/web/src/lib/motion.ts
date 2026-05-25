import type { Easing, Transition, Variants } from "framer-motion";
import { useReducedMotion as useFramerReducedMotion } from "framer-motion";

export function useReducedMotion() {
  return useFramerReducedMotion() ?? false;
}

export const springs = {
  gentle: { type: "spring" as const, stiffness: 200, damping: 30, mass: 1 } satisfies Transition,
  bouncy: { type: "spring" as const, stiffness: 400, damping: 20, mass: 0.8 } satisfies Transition,
  snappy: { type: "spring" as const, stiffness: 500, damping: 35, mass: 0.6 } satisfies Transition,
  slow:   { type: "spring" as const, stiffness: 120, damping: 28, mass: 1.2 } satisfies Transition,
};

export const durations = {
  fast:     0.15,
  normal:   0.25,
  slow:     0.45,
  verySlow: 0.7,
};

export const easings = {
  easeOut:   [0.16, 1, 0.3, 1] as [number, number, number, number],
  easeInOut: [0.4, 0, 0.2, 1]  as [number, number, number, number],
  easeIn:    [0.4, 0, 1, 1]    as [number, number, number, number],
} satisfies Record<string, Easing>;

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: durations.slow, ease: easings.easeOut } },
  exit:    { opacity: 0, transition: { duration: durations.normal, ease: easings.easeIn } },
};

export const fadeInUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: easings.easeOut } },
  exit:    { opacity: 0, y: 24, transition: { duration: durations.normal, ease: easings.easeIn } },
};

export const fadeInDown: Variants = {
  hidden:  { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: easings.easeOut } },
  exit:    { opacity: 0, y: -16, transition: { duration: durations.normal, ease: easings.easeIn } },
};

export const fadeInLeft: Variants = {
  hidden:  { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: durations.slow, ease: easings.easeOut } },
  exit:    { opacity: 0, x: -24, transition: { duration: durations.normal, ease: easings.easeIn } },
};

export const fadeInRight: Variants = {
  hidden:  { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: durations.slow, ease: easings.easeOut } },
  exit:    { opacity: 0, x: 24, transition: { duration: durations.normal, ease: easings.easeIn } },
};

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: springs.gentle },
  exit:    { opacity: 0, scale: 0.92, transition: { duration: durations.normal } },
};

export const pageVariants: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: easings.easeOut } },
  exit:    { opacity: 0, y: -8, transition: { duration: durations.normal, ease: easings.easeIn } },
};

export const staggerContainer: Variants = {
  hidden:  {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export const staggerFast: Variants = {
  hidden:  {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.0,
    },
  },
};

export const staggerSlow: Variants = {
  hidden:  {},
  visible: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

export const listItem: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: easings.easeOut } },
};
