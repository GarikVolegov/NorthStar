/**
 * Navbar.tsx — apps/web
 *
 * Top navigation bar for NorthStar.
 *
 * Desktop (≥ md): logo + link orizzontali + badge premium/auth buttons
 * Mobile  (< md): logo + hamburger button → MobileDrawer slide-in
 *
 * Regole rispettate (FRONTEND_RULES.md):
 *   ✔ Tutti i tap target ≥ 44px (.touch-target)
 *   ✔ .tap-highlight-none su ogni elemento cliccabile
 *   ✔ .no-select su elementi non-testo
 *   ✔ Nessun re-render inutile (useMobileNav con useCallback interno)
 *   ✔ MobileDrawer usa translate (GPU) non left/right (CPU)
 *   ✔ aria-label su tutti i bottoni icon-only
 *   ✔ aria-current="page" su link attivi
 */

import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useMobileNav } from '@/hooks/useMobileNav';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { DrawerNavLink } from '@/components/layout/DrawerNavLink';
import { cn } from '@/lib/utils';

// ─── Nav items config ──────────────────────────────────────────────────────
const PUBLIC_NAV = [
  { href: '/',              label: 'Home' },
  { href: '/come-funziona', label: 'Come funziona' },
  { href: '/chi-siamo',     label: 'Chi siamo' },
];

const AUTH_NAV = [
  { href: '/dashboard',  label: 'Dashboard' },
  { href: '/settori',    label: 'Settori' },
  { href: '/percorso',   label: 'Percorso',  premium: true },
  { href: '/mappa',      label: 'Mappa',     premium: true },
  { href: '/wiki',       label: 'Wiki AI',   premium: true },
  { href: '/news',       label: 'News',      premium: true },
  { href: '/coach',      label: 'Coach AI',  premium: true },
  { href: '/colloquio',  label: 'Colloquio', premium: true },
  { href: '/skills-gap', label: 'Skills Gap',premium: true },
  { href: '/amici',      label: 'Community' },
  { href: '/calendario', label: 'Calendario' },
  { href: '/profilo',    label: 'Profilo' },
];

// ─── Hamburger icon (inline SVG, no Lucide import overhead) ───────────────
function HamburgerIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="22" height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {isOpen ? (
        // X
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ) : (
        // Menu
        <>
          <line x1="3" y1="6"  x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </>
      )}
    </svg>
  );
}

// ─── Desktop NavLink ──────────────────────────────────────────────────
function DesktopNavLink({
  href, label, isPremium = false, isActive,
}: {
  href: string;
  label: string;
  isPremium?: boolean;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'relative px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150',
        'tap-highlight-none',
        isActive
          ? 'text-[#c19e4a]'
          : 'text-[#7db89a] hover:text-[#e6e8ed]',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {label}
      {isPremium && (
        <span className="ml-1 text-[10px] text-[#c19e4a]/60 align-super">★</span>
      )}
      {isActive && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c19e4a]" />
      )}
    </Link>
  );
}

// ─── Navbar ────────────────────────────────────────────────────────────
export function Navbar() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const nav = useMobileNav(location);

  const navItems = user ? AUTH_NAV : PUBLIC_NAV;
  // Desktop: max 5 voci visibili, resto nel drawer
  const desktopItems = navItems.slice(0, 5);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-30 w-full',
          'bg-[#0e1018]/90 backdrop-blur-md border-b border-[rgba(193,158,74,0.12)]',
          // Safe area top per iPhone notch
          'pt-[env(safe-area-inset-top,0px)]',
        )}
      >
        <div className="flex items-center justify-between h-14 px-4 md:px-6 max-w-7xl mx-auto">

          {/* ── Logo ───────────────────────────────────────────────── */}
          <Link
            href="/"
            className="tap-highlight-none no-select flex items-center gap-2 shrink-0"
            aria-label="NorthStar — torna alla home"
          >
            <span className="text-[#c19e4a] font-bold text-lg tracking-tight">
              North<span className="text-[#e6e8ed]">Star</span>
            </span>
          </Link>

          {/* ── Desktop nav ─────────────────────────────────────────── */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navigazione principale">
            {desktopItems.map((item) => (
              <DesktopNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                isPremium={'premium' in item && !!item.premium}
                isActive={location === item.href}
              />
            ))}
            {/* Mostra "Altro" se ci sono più di 5 voci */}
            {navItems.length > 5 && (
              <button
                onClick={nav.open}
                className="px-3 py-2 text-sm font-medium text-[#7db89a] hover:text-[#e6e8ed] rounded-lg transition-colors tap-highlight-none"
                aria-label="Mostra più voci di menu"
              >
                Altro ‹
              </button>
            )}
          </nav>

          {/* ── Desktop auth buttons ──────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                {!user.isPremium && (
                  <Link
                    href="/premium"
                    className="px-3 py-1.5 text-xs font-semibold text-[#0e1018] bg-[#c19e4a] rounded-lg hover:bg-[#c19e4a]/90 transition-colors tap-highlight-none"
                  >
                    ★ Premium
                  </Link>
                )}
                <Link
                  href="/profilo"
                  className={cn(
                    'touch-target tap-highlight-none rounded-full overflow-hidden',
                    'w-8 h-8 flex items-center justify-center',
                    'bg-[#1a1d2a] border border-[rgba(193,158,74,0.3)]',
                    'text-[#c19e4a] text-sm font-semibold',
                  )}
                  aria-label="Vai al profilo"
                >
                  {(user.firstName?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-[#7db89a] hover:text-[#e6e8ed] transition-colors tap-highlight-none"
                >
                  Accedi
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-semibold text-[#0e1018] bg-[#c19e4a] rounded-lg hover:bg-[#c19e4a]/90 transition-colors tap-highlight-none"
                >
                  Inizia gratis
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile: CTA + Hamburger ───────────────────────────────── */}
          <div className="flex md:hidden items-center gap-1">
            {/* CTA rapida solo se non autenticato */}
            {!user && (
              <Link
                href="/register"
                className="px-3 py-1.5 text-xs font-semibold text-[#0e1018] bg-[#c19e4a] rounded-lg tap-highlight-none"
              >
                Inizia
              </Link>
            )}
            {/* Hamburger */}
            <button
              onClick={nav.toggle}
              className="touch-target tap-highlight-none no-select rounded-lg text-[#7db89a] hover:text-[#e6e8ed] transition-colors"
              aria-label={nav.isOpen ? 'Chiudi menu' : 'Apri menu'}
              aria-expanded={nav.isOpen}
              aria-controls="mobile-drawer"
            >
              <HamburgerIcon isOpen={nav.isOpen} />
            </button>
          </div>

        </div>
      </header>

      {/* ── Mobile Drawer ────────────────────────────────────────────── */}
      <MobileDrawer
        isOpen={nav.isOpen}
        onClose={nav.close}
        // id per aria-controls
      >
        <div id="mobile-drawer" className="py-2">

          {/* Sezione pubblica */}
          <div className="px-4 pt-2 pb-1">
            <p className="text-[10px] font-semibold text-[#7db89a]/50 uppercase tracking-widest">
              Menu
            </p>
          </div>
          {PUBLIC_NAV.map((item) => (
            <DrawerNavLink key={item.href} href={item.href} onClick={nav.close}>
              {item.label}
            </DrawerNavLink>
          ))}

          {/* Sezione autenticata */}
          {user && (
            <>
              <div className="mx-4 my-2 border-t border-[rgba(193,158,74,0.1)]" />
              <div className="px-4 pb-1">
                <p className="text-[10px] font-semibold text-[#7db89a]/50 uppercase tracking-widest">
                  La mia area
                </p>
              </div>
              {AUTH_NAV.filter(i => !('premium' in i) || !i.premium).map((item) => (
                <DrawerNavLink key={item.href} href={item.href} onClick={nav.close}>
                  {item.label}
                </DrawerNavLink>
              ))}

              {/* Sezione premium */}
              {user.isPremium && (
                <>
                  <div className="mx-4 my-2 border-t border-[rgba(193,158,74,0.1)]" />
                  <div className="px-4 pb-1">
                    <p className="text-[10px] font-semibold text-[#c19e4a]/60 uppercase tracking-widest">
                      ★ Premium
                    </p>
                  </div>
                  {AUTH_NAV.filter(i => 'premium' in i && i.premium).map((item) => (
                    <DrawerNavLink key={item.href} href={item.href} onClick={nav.close}>
                      {item.label}
                    </DrawerNavLink>
                  ))}
                </>
              )}

              {/* Upgrade CTA se non premium */}
              {!user.isPremium && (
                <div className="px-4 pt-3 pb-2">
                  <Link
                    href="/premium"
                    onClick={nav.close}
                    className="block w-full text-center py-3 rounded-xl bg-[#c19e4a] text-[#0e1018] text-sm font-bold tap-highlight-none hover:bg-[#c19e4a]/90 transition-colors"
                  >
                    ★ Sblocca Premium
                  </Link>
                </div>
              )}
            </>
          )}

          {/* Auth links se non loggato */}
          {!user && (
            <div className="px-4 pt-4 pb-2 flex flex-col gap-2">
              <Link
                href="/register"
                onClick={nav.close}
                className="block w-full text-center py-3 rounded-xl bg-[#c19e4a] text-[#0e1018] text-sm font-bold tap-highlight-none"
              >
                Inizia gratis
              </Link>
              <Link
                href="/login"
                onClick={nav.close}
                className="block w-full text-center py-3 rounded-xl border border-[rgba(193,158,74,0.3)] text-[#7db89a] text-sm font-medium tap-highlight-none hover:text-[#e6e8ed]"
              >
                Accedi
              </Link>
            </div>
          )}

        </div>
      </MobileDrawer>
    </>
  );
}
