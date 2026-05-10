/**
 * BottomNav.tsx — apps/web
 *
 * Bottom navigation bar visibile solo su mobile (< md).
 * Fornisce accesso rapido alle 4-5 sezioni più usate.
 *
 * Regole rispettate (FRONTEND_RULES.md):
 *   ✔ Tap target ≥44px su ogni voce
 *   ✔ .tap-highlight-none + .no-select
 *   ⏄ Safe area inset-bottom (iPhone home indicator)
 *   ✔ aria-current="page" sulla voce attiva
 *   ✔ Nessun re-render inutile (location da wouter, niente state)
 *   ✔ Nascosto su md+ con md:hidden (non mountato, non solo nascosto)
 */

import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useRequests } from '@/hooks/useNetwork';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

// ─── SVG icons inline ────────────────────────────────────────────
// Icona "network/community" per /amici (sostituisce quella generica "home")
const Icons = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  explore: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  roadmap: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  profile: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  test: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  // Icona persone per la sezione Community/Network
  network: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
} as const;

// ─── Nav item config ────────────────────────────────────────────
const PUBLIC_BOTTOM_NAV = [
  { href: '/',              icon: 'home'    as const, label: 'Home' },
  { href: '/test',          icon: 'test'    as const, label: 'Test' },
  { href: '/come-funziona', icon: 'explore' as const, label: 'Info' },
];

const AUTH_BOTTOM_NAV = [
  { href: '/dashboard', icon: 'dashboard' as const, label: 'Dashboard' },
  { href: '/settori',   icon: 'explore'   as const, label: 'Settori' },
  { href: '/percorso',  icon: 'roadmap'   as const, label: 'Percorso' },
  { href: '/amici',     icon: 'network'   as const, label: 'Community' },
  { href: '/profilo',   icon: 'profile'   as const, label: 'Profilo' },
];

// ─── Hook badge richieste ───────────────────────────────────────────
// Polling ogni 60s: così l'utente vede il badge aggiornarsi senza refresh.
// staleTime 20s già impostato in useRequests, refetchInterval aggiunto qui.
function useRequestsBadge() {
  const { data } = useRequests({ refetchInterval: 60_000 });
  return data?.requests?.length ?? 0;
}

// ─── Badge component ────────────────────────────────────────────
function RequestsBadge({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key="badge"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1
                     bg-blue-500 text-white text-[9px] font-bold
                     rounded-full flex items-center justify-center
                     pointer-events-none"
          aria-label={`${count} richieste di connessione`}
        >
          {count > 9 ? '9+' : count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ─── Single nav item ───────────────────────────────────────────
function BottomNavItem({
  href, icon, label, isActive, badgeCount = 0,
}: {
  href: string;
  icon: keyof typeof Icons;
  label: string;
  isActive: boolean;
  badgeCount?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'touch-target tap-highlight-none no-select',
        'flex flex-col items-center justify-center gap-0.5 flex-1',
        'text-[10px] font-medium tracking-wide',
        isActive
          ? 'text-[#c19e4a]'
          : 'text-[#7db89a]/70 hover:text-[#7db89a]',
        'transition-colors duration-150',
      )}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label + (badgeCount > 0 ? ` (${badgeCount} richieste)` : '')}
    >
      <span className="relative">
        {Icons[icon]}

        {/* Dot indicator attivo */}
        {isActive && (
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c19e4a]"
            aria-hidden="true"
          />
        )}

        {/* Badge richieste */}
        <RequestsBadge count={badgeCount} />
      </span>
      <span>{label}</span>
    </Link>
  );
}

// ─── BottomNav ──────────────────────────────────────────────────────
export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Il badge viene fetchato solo se l'utente è loggato
  const requestCount = user ? useRequestsBadge() : 0; // eslint-disable-line react-hooks/rules-of-hooks

  const items = user ? AUTH_BOTTOM_NAV : PUBLIC_BOTTOM_NAV;

  const HIDDEN_ON = ['/login', '/register', '/test'];
  if (HIDDEN_ON.includes(location)) return null;

  return (
    <nav
      className={cn(
        'md:hidden',
        'fixed bottom-0 left-0 right-0 z-30',
        'bg-[#0e1018]/95 backdrop-blur-md border-t border-[rgba(193,158,74,0.12)]',
        'pb-[env(safe-area-inset-bottom,0px)]',
      )}
      aria-label="Navigazione inferiore"
    >
      <div className="flex items-stretch h-14">
        {items.map((item) => (
          <BottomNavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={
              location === item.href ||
              (item.href !== '/' && location.startsWith(item.href))
            }
            badgeCount={item.href === '/amici' ? requestCount : 0}
          />
        ))}
      </div>
    </nav>
  );
}
