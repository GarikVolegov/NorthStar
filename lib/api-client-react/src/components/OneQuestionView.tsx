import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';

interface Question {
  id: number;
  text: string;
  category: string;
}

interface Props {
  question: Question;
  index: number;
  total: number;
  onAnswer: (value: number) => void;
  direction: 1 | -1; // Allineato con useTestState
}

const LABELS = [
  "Per niente d'accordo",
  "Poco d'accordo",
  'Neutrale',
  "D'accordo",
  "Completamente d'accordo",
];

export function OneQuestionView({ question, index, total, onAnswer, direction }: Props) {
  // Blocca double-tap: dopo click disabilita i bottoni finché il parent aggiorna index
  const [answered, setAnswered] = useState(false);

  // Reset quando cambia domanda (index cambia dopo onAnswer)
  const prevIndexRef = useRef(index);
  if (prevIndexRef.current !== index) {
    prevIndexRef.current = index;
    // Resetta senza trigger useEffect (aggiornamento sincrono durante render)
    if (answered) setAnswered(false);
  }

  const handleAnswer = (val: number) => {
    if (answered) return; // Previene double-tap
    setAnswered(true);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    onAnswer(val);
  };

  // Percentuale corretta: index/total = progresso PRIMA di rispondere
  const progressBefore = (index / total) * 100;
  const progressAfter = ((index + 1) / total) * 100;

  return (
    // AnimatePresence DEVE wrappare motion.div con exit per funzionare
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={question.id} // Key change triggera exit dell'elemento precedente
        initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="min-h-[80vh] flex flex-col items-center justify-center px-4"
      >
        {/* Barra progresso: parte da index/total, anima a (index+1)/total */}
        <div className="w-full max-w-md mb-12">
          <div className="h-2 bg-[#1a1d2a] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#c19e4a]"
              initial={{ width: `${progressBefore}%` }}
              animate={{ width: answered ? `${progressAfter}%` : `${progressBefore}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <p className="text-center text-[#7db89a] text-sm mt-3 font-medium">
            Domanda {index + 1} di {total}
          </p>
        </div>

        {/* Testo domanda */}
        <h2 className="text-2xl md:text-3xl font-bold text-[#e6e8ed] text-center max-w-2xl mb-12 leading-relaxed">
          {question.text}
        </h2>

        {/* Pulsanti touch-friendly */}
        <div className="w-full max-w-md space-y-3">
          {[1, 2, 3, 4, 5].map((val) => (
            <motion.button
              key={val}
              whileHover={answered ? {} : { scale: 1.02 }}
              whileTap={answered ? {} : { scale: 0.98 }}
              onClick={() => handleAnswer(val)}
              disabled={answered}
              className="w-full py-4 px-6 rounded-xl border border-[#c19e4a]/20 bg-[#1a1d2a]/80
                         text-[#e6e8ed] text-lg font-medium transition-all
                         hover:bg-[#c19e4a]/10 hover:border-[#c19e4a]/40
                         focus:outline-none focus:ring-2 focus:ring-[#c19e4a]/50
                         active:bg-[#c19e4a]/20
                         disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`${LABELS[val - 1]}, valore ${val} su 5`}
            >
              <span className="flex items-center justify-between">
                <span>{LABELS[val - 1]}</span>
                <span className="text-[#c19e4a]/60 text-sm">{val}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
