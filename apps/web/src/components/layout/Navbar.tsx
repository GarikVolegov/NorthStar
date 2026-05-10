/**
 * Navbar.tsx — apps/web
 *
 * Barra di navigazione superiore.
 * Mostra logo, navigazione principale, stato utente e notifiche.
 */

import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useRequests } from '@/hooks/useNetwork';
import { cn } from '@/lib/utils';

export function Navbar() {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();
  const { data: reqs } = useRequests({ refetchInterval: 30_000 });
  const requestCount = reqs?.requests?.length ?? 0;

  const navItems = [
    { href: '/',        label: 'Home' },
    { href: '/settori', label: 'Settori' },
    { href: '/amici',   label: 'Community' },
  ];

  const authItems = user
    ? [
        { href: '/profilo',   label: 'Profilo' },
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/amici',     label: 'Messaggi' },
      ]
    : [
        { href: '/login',    label: 'Accedi' },
        { href: '/register', label: 'Registrati' },
      ];

  return (
    <nav
      className="sticky top-0 z-40 bg-[#0e1018]/95 backdrop-blur-md
                 border-b border-[rgba(193,158,74,0.1)]"
      aria-label="Navigazione principale"
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-lg font-bold text-[#c19e4a]">⭐</span>
          <span className="text-sm font-semibold text-[#e6e8ed] tracking-tight">
            NorthStar
          </span>
        </Link>

        {/* Nav principale */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg',
                'transition-colors duration-150',
                location === item.href
                  ? 'text-[#c19e4a] bg-[#c19e4a]/10'
                  : 'text-[#7db89a]/70 hover:text-[#e6e8ed] hover:bg-[#ffffff08]',
              )}
              aria-current={location === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Utente / Auth */}
        <div className="flex items-center gap-2">
          {!isLoading && user && (
            <Link
              href="/amici"
              className="relative tap-highlight-none"
              aria-label={`Messaggi${requestCount > 0 ? ` (${requestCount} richieste)` : ''}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="text-[#7db89a]"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {requestCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5
                             bg-[#c19e4a] text-[#0b0d14] text-[9px] font-bold
                             rounded-full flex items-center justify-center"
                  aria-label={`${requestCount} richieste di connessione`}
                >
                  {requestCount > 9 ? '9+' : requestCount}
                </span>
              )}
            </Link>
          )}

          <div className="hidden md:flex items-center gap-1">
            {isLoading ? (
              <div className="w-20 h-6 bg-[#1a1d2a] rounded animate-pulse" />
            ) : user ? (
              <>
                <span className="text-xs text-[#7db89a]/60 truncate max-w-[100px]">
                  {user.name}
                </span>
                {user.isAdmin && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#c19e4a]/10 text-[#c19e4a]/80">
                    ADMIN
                  </span>
                )}
              </>
            ) : (
              authItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-lg',
                    'transition-colors duration-150',
                    location === item.href
                      ? 'text-[#c19e4a] bg-[#c19e4a]/10'
                      : 'text-[#7db89a]/70 hover:text-[#e6e8ed]',
                  )}
                  aria-current={location === item.href ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}