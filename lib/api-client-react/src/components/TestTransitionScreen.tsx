import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface Props {
  from: string;
  to: string;
  onComplete: () => void;
}

const POETIC_LINES = [
  "Oltre le domande, nascono le risposte...",
  "Il tuo carattere prende forma...",
  "Scopriamo insieme chi sei davvero...",
];

// Scelta stabile: non ricalcolata ad ogni render
function pickLine(): string {
  return POETIC_LINES[Math.floor(Math.random() * POETIC_LINES.length)];
}

export function TestTransitionScreen({ from, to, onComplete }: Props) {
  const [phase, setPhase] = useState(0);

  // Fissa la frase al mount, non ri-sorteggia su re-render
  const [poeticLine] = useState(pickLine);

  // Ref per evitare double-fire di onComplete se il parent re-renderizza
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 2500);
    // Chiama sempre la versione più recente di onComplete senza metterla nelle deps
    const t3 = setTimeout(() => onCompleteRef.current(), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Eseguito solo al mount — corretto per una schermata di transizione

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0e1018]">
      <AnimatePresence mode="wait">
        {phase === 0 ? (
          <motion.div
            key="fadeout"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 bg-[#0e1018]"
          />
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="text-center px-6"
          >
            {/* Etichetta sezioni: mostra solo se entrambe presenti */}
            {from && to && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-[#c19e4a] text-sm tracking-[0.3em] uppercase mb-6"
              >
                {from} → {to}
              </motion.div>
            )}

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 1 }}
              className="text-3xl md:text-5xl font-bold text-[#e6e8ed] mb-8 leading-tight"
            >
              {poeticLine}
            </motion.h2>

            {/* Progress bar: durata 3.2s per coprire fino al timeout 4000ms - delay 0.8s */}
            <motion.div className="w-48 h-1 bg-[#1a1d2a] rounded-full mx-auto overflow-hidden">
              <motion.div
                className="h-full bg-[#c19e4a]"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 3.2, ease: 'easeInOut' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
