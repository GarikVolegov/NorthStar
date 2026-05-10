import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface Props {
  profileName: string;
  subtitle: string;
  onRevealComplete: () => void;
}

export function ResultReveal({ profileName, subtitle, onRevealComplete }: Props) {
  const [phase, setPhase] = useState(0);

  // Ref guard: evita reset timer se il parent passa nuova referenza di onRevealComplete
  const onRevealCompleteRef = useRef(onRevealComplete);
  useEffect(() => {
    onRevealCompleteRef.current = onRevealComplete;
  }, [onRevealComplete]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => onRevealCompleteRef.current(), 5000),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount-only: schermata di reveal non si ripete

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0e1018]">
      <AnimatePresence>
        {/* LAYER 1: stella — key obbligatoria per AnimatePresence */}
        {phase >= 1 && (
          <motion.div
            key="star"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className="relative z-10"
          >
            <div className="w-32 h-32 md:w-48 md:h-48 relative">
              {/* Pulse ring: easing corretto per evitare pop */}
              <motion.div
                className="absolute inset-0 bg-[#c19e4a]/20 rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut', // era mancante: causava pop brusco
                  times: [0, 0.5, 1],
                }}
              />
              {/* drop-shadow su SVG path className non funziona: usare filter style sull'svg */}
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full text-[#c19e4a] relative z-10"
                style={{ filter: 'drop-shadow(0 0 30px rgba(193,158,74,0.5))' }}
              >
                <path
                  d="M50 5 L61 39 L97 39 L68 59 L79 93 L50 73 L21 93 L32 59 L3 39 L39 39 Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </motion.div>
        )}

        {/* LAYER 2: testo — separato dalla stella, key propria */}
        {phase >= 2 && (
          <motion.div
            key="text"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-20"
          >
            <h1
              className="text-4xl md:text-6xl font-bold text-[#e6e8ed] mb-4"
              style={{ textShadow: '0 0 40px rgba(193,158,74,0.3)' }}
            >
              Sei un{' '}
              <span className="text-[#c19e4a]">{profileName}</span>
            </h1>

            {/*
              LAYER 3: sottotitolo — AnimatePresence separata per gestire
              l'enter animation di phase>=3 senza essere blocked dal parent.
              Il nesting originale (motion.p dentro motion.div senza AnimatePresence)
              non triggera l'animazione initial/animate al cambio di phase.
            */}
            <AnimatePresence>
              {phase >= 3 && (
                <motion.p
                  key="subtitle"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-xl text-[#e6e8ed]/70 max-w-lg"
                >
                  {subtitle}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
