/**
 * WendyMuteButton
 * Bottone floating per mutare/smutare voce e sottofondo di Wendy.
 * Si posiziona in bottom-right con z-50, sopra qualsiasi contenuto.
 * Accetta una prop `className` per override di posizione se necessario.
 */
import { cn } from "@/lib/utils";
import { getMuted, subscribe, toggleMuted } from "@/lib/wendy-voice";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

interface WendyMuteButtonProps {
  /** Overrides per posizionamento (default: fixed bottom-6 right-6) */
  className?: string;
}

export function WendyMuteButton({ className }: WendyMuteButtonProps) {
  const [isMuted, setIsMuted] = useState(getMuted);

  // Sincronizza con cambiamenti provenienti da altre parti del codice
  useEffect(() => subscribe(setIsMuted), []);

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50",
        // Su mobile sposta sopra la safe area (home bar iPhone)
        "pb-[env(safe-area-inset-bottom,0px)]",
        className,
      )}
    >
      {/* Tooltip */}
      <div className="group relative flex items-center justify-center">
        <AnimatePresence>
          <motion.span
            key={isMuted ? "off" : "on"}
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 0 }}           // rimane nascosto finché hover
            className="
              pointer-events-none absolute bottom-full mb-2 right-0
              whitespace-nowrap rounded-lg bg-foreground/90 px-2.5 py-1
              text-xs text-background font-medium shadow-md
              opacity-0 group-hover:opacity-100 transition-opacity duration-150
            "
          >
            {isMuted ? "Riattiva audio" : "Silenzia audio"}
          </motion.span>
        </AnimatePresence>

        {/* Bottone */}
        <motion.button
          aria-label={isMuted ? "Riattiva audio di Wendy" : "Silenzia audio di Wendy"}
          onClick={toggleMuted}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.08 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={cn(
            "relative flex items-center justify-center",
            "w-11 h-11 rounded-full shadow-lg",
            "border border-border/60 backdrop-blur-md",
            "transition-colors duration-200",
            isMuted
              ? "bg-muted/90 text-muted-foreground hover:bg-muted"
              : "bg-background/90 text-foreground hover:bg-background",
          )}
        >
          <AnimatePresence mode="wait">
            {isMuted ? (
              <motion.span
                key="muted"
                initial={{ opacity: 0, scale: 0.6, rotate: -15 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, rotate: 15 }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-center"
              >
                <VolumeX className="w-4.5 h-4.5" />
              </motion.span>
            ) : (
              <motion.span
                key="active"
                initial={{ opacity: 0, scale: 0.6, rotate: 15 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, rotate: -15 }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-center"
              >
                <Volume2 className="w-4.5 h-4.5" />
              </motion.span>
            )}
          </AnimatePresence>

          {/* Anello pulsante — visibile solo quando NON mutato */}
          {!isMuted && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-primary/30 pointer-events-none"
              animate={{ scale: [1, 1.55, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </motion.button>
      </div>
    </div>
  );
}
