/**
 * SmartSkeleton.tsx — apps/web
 *
 * Skeleton placeholder universale per contenuti in caricamento.
 * Supporta diversi layout: card, text, avatar, form.
 */

import { motion } from 'framer-motion';

type Props = {
  type?: 'card' | 'text' | 'avatar' | 'form' | 'full';
  message?: string;
  className?: string;
};

/**
 * Animazione shimmer condivisa
 */
const shimmer = `
  background: linear-gradient(
    90deg,
    rgba(26, 29, 42, 1) 25%,
    rgba(42, 45, 66, 0.6) 50%,
    rgba(26, 29, 42, 1) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
`;

export function SmartSkeleton({
  type = 'card',
  message,
  className = '',
}: Props) {
  // Per i tipi che non esistono nell'origine dati, restituiamo comunque
  // uno skeleton valido così da non bloccare la compilazione
  return (
    <div className={className} role="status" aria-label="Caricamento in corso">
      {type === 'card' && (
        <div className="space-y-3">
          <motion.div
            className="h-4 bg-[#2a2d3a] rounded w-3/4"
            style={{ ...shimmerStyle }}
          />
          <motion.div
            className="h-4 bg-[#2a2d3a] rounded w-1/2"
            style={{ ...shimmerStyle, animationDelay: '0.1s' }}
          />
          <motion.div
            className="h-20 bg-[#1a1d2a] rounded-xl border border-[#c19e4a]/5"
            style={{ ...shimmerStyle, animationDelay: '0.2s' }}
          />
        </div>
      )}

      {type === 'text' && (
        <motion.div
          className="h-4 bg-[#2a2d3a] rounded w-full"
          style={{ ...shimmerStyle }}
        />
      )}

      {type === 'avatar' && (
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-full bg-[#2a2d3a]"
            style={{ ...shimmerStyle }}
          />
          <div className="space-y-2">
            <motion.div
              className="h-3 bg-[#2a2d3a] rounded w-24"
              style={{ ...shimmerStyle, animationDelay: '0.1s' }}
            />
            <motion.div
              className="h-2 bg-[#2a2d3a] rounded w-16"
              style={{ ...shimmerStyle, animationDelay: '0.2s' }}
            />
          </div>
        </div>
      )}

      {type === 'form' && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="h-10 bg-[#2a2d3a] rounded-lg"
              style={{ ...shimmerStyle, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      )}

      {type === 'full' && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="h-48 bg-[#1a1d2a] rounded-xl border border-[#c19e4a]/5"
              style={{ ...shimmerStyle, animationDelay: `${i * 0.05}s` }}
            >
              <div className="p-4 space-y-3">
                <div className="h-4 bg-[#2a2d3a] rounded w-2/3" />
                <div className="h-2 bg-[#2a2d3a] rounded w-1/2" />
                <div className="h-16 bg-[#2a2d3a]/50 rounded" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {message && (
        <p className="text-xs text-[#7db89a]/40 mt-4 text-center">{message}</p>
      )}
    </div>
  );
}

const shimmerStyle = {
  background: `linear-gradient(
    90deg,
    rgba(26, 29, 42, 1) 25%,
    rgba(42, 45, 66, 0.6) 50%,
    rgba(26, 29, 42, 1) 75%
  )`,
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s ease-in-out infinite',
};

// Inject shimmer keyframes
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}