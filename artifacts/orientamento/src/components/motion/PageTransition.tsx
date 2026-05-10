import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useReducedMotion, easings, durations } from "@/lib/motion";
import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const [location] = useLocation();
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: durations.slow, ease: easings.easeOut },
        }}
        exit={{
          opacity: 0,
          y: -6,
          transition: { duration: durations.normal, ease: easings.easeIn },
        }}
        style={{ willChange: "opacity, transform" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
