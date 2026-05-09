/**
 * BottomNav.tsx — apps/web
 *
 * Bottom navigation bar visibile solo su mobile (< md).
 * Fornisce accesso rapido alle 4-5 sezioni più usate.
 *
 * Regole rispettate (FRONTEND_RULES.md):
 *   ✔ Tap target ≥ 44px su ogni voce
 *   ✔ .tap-highlight-none + .no-select
 *   ⌔ Safe area inset-bottom (iPhone home indicator)
 *   ✔ aria-current="page" sulla voce attiva
 *   ✔ Nessun re-render inutile (location da wouter, niente state)
 *   ✔ Nascosto su md+ con md:hidden (non mountato, non solo nascosto)
 */

import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// ─── SVG icons inline ────────────────────────────────────────────────────
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
} as const;

// ─── Nav item config ──────────────────────────────────────────────────
const PUBLIC_BOTTOM_NAV = [
  { href: '/',             icon: 'home'    as const, label: 'Home' },
  { href: '/test',         icon: 'test'    as const, label: 'Test' },
  { href: '/come-funziona',icon: 'explore' as const, label: 'Info' },
];

const AUTH_BOTTOM_NAV = [
  { href: '/dashboard',   icon: 'dashboard' as const, label: 'Dashboard' },
  { href: '/settori',     icon: 'explore'   as const, label: 'Settori' },
  { href: '/percorso',    icon: 'roadmap'   as const, label: 'Percorso' },
  { href: '/amici',       icon: 'home'      as const, label: 'Community' },
  { href: '/profilo',     icon: 'profile'   as const, label: 'Profilo' },
];

// ─── Single nav item ─────────────────────────────────────────────────
function BottomNavItem({
  href, icon, label, isActive,
}: {
  href: string;
  icon: keyof typeof Icons;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // Tap target 44px garantito
        'touch-target tap-highlight-none no-select',
        // Layout colonna
        'flex flex-col items-center justify-center gap-0.5 flex-1',
        'text-[10px] font-medium tracking-wide',
        // Colori
        isActive
          ? 'text-[#c19e4a]'
          : 'text-[#7db89a]/70 hover:text-[#7db89a]',
        'transition-colors duration-150',
      )}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
    >
      {/* Dot indicator attivo */}
      <span className="relative">
        {Icons[icon]}
        {isActive && (
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c19e4a]"
            aria-hidden="true"
          />
        )}
      </span>
      <span>{label}</span>
    </Link>
  );
}

// ─── BottomNav ──────────────────────────────────────────────────────────
export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  const items = user ? AUTH_BOTTOM_NAV : PUBLIC_BOTTOM_NAV;

  // Nasconde su pagine senza navigazione
  const HIDDEN_ON = ['/login', '/register', '/test'];
  if (HIDDEN_ON.includes(location)) return null;

  return (
    <nav
      className={cn(
        // Solo mobile
        'md:hidden',
        // Posizione fissa in basso
        'fixed bottom-0 left-0 right-0 z-30',
        // Background + bordo
        'bg-[#0e1018]/95 backdrop-blur-md border-t border-[rgba(193,158,74,0.12)]',
        // Safe area iPhone home indicator
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
            isActive={location === item.href || (item.href !== '/' && location.startsWith(item.href))}
          />
        ))}
      </div>
    </nav>
  );
}
