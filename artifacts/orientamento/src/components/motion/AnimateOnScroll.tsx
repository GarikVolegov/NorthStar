import { useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";
import { useReducedMotion, easings, durations } from "@/lib/motion";
import type { Variants } from "framer-motion";
import { staggerContainer } from "@/lib/motion";

interface AnimateOnScrollProps {
  children: ReactNode;
  variants?: Variants;
  className?: string;
  delay?: number;
  once?: boolean;
  amount?: number;
  stagger?: boolean;
}

const defaultVariants = (delay: number): Variants => ({
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.slow, ease: easings.easeOut, delay },
  },
});

const staggerVariants = (delay: number): Variants => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: delay,
    },
  },
});

export function AnimateOnScroll({
  children,
  variants,
  className,
  delay = 0,
  once = true,
  amount = 0.15,
  stagger = false,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount });
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  const activeVariants: Variants = stagger
    ? staggerVariants(delay)
    : variants ?? defaultVariants(delay);

  return (
    <motion.div
      ref={ref}
      variants={activeVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.slow, ease: easings.easeOut },
  },
};

export function AnimateOnScrollItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}
