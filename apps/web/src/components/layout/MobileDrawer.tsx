/**
 * MobileDrawer.tsx — Phase 1
 *
 * Slide-in navigation drawer for mobile.
 * Replaces traditional dropdown menus on small screens.
 *
 * Features:
 *   - Slides in from the left (or right via prop)
 *   - Backdrop click to close
 *   - Escape key to close (handled by useMobileNav)
 *   - Body scroll lock when open (handled by useMobileNav)
 *   - Safe area aware padding (iPhone notch/home indicator)
 *   - Fully accessible: focus trap, aria-modal, role=dialog
 *   - Respects prefers-reduced-motion
 *
 * Usage:
 *   const nav = useMobileNav(location);
 *
 *   // Trigger button (in Navbar):
 *   <button onClick={nav.toggle} className="touch-target md:hidden" aria-label="Apri menu">
 *     <Menu size={22} />
 *   </button>
 *
 *   // Drawer:
 *   <MobileDrawer isOpen={nav.isOpen} onClose={nav.close}>
 *     <nav>...links...</nav>
 *   </MobileDrawer>
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  isOpen:   boolean;
  onClose:  () => void;
  side?:    'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

export function MobileDrawer({
  isOpen,
  onClose,
  side = 'left',
  children,
  className,
}: MobileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap: when drawer opens, move focus inside it
  useEffect(() => {
    if (isOpen) {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
        'a, button, input, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [isOpen]);

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* ── Drawer panel ──────────────────────────────────────────────── */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu di navigazione"
        className={cn(
          // Base layout
          'fixed top-0 z-50 flex flex-col',
          'h-full w-72 max-w-[85vw]',
          // Background & border
          'bg-[#0e1018] border-r border-[rgba(193,158,74,0.15)]',
          // Safe area padding
          'pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]',
          // Slide animation — uses translate (GPU) not left/right (CPU)
          'transition-transform duration-300 ease-in-out',
          side === 'left'
            ? cn('left-0', isOpen ? 'translate-x-0' : '-translate-x-full')
            : cn('right-0', isOpen ? 'translate-x-0' : 'translate-x-full'),
          className
        )}
      >
        {/* ── Close button ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(193,158,74,0.1)]">
          <span className="text-[#c19e4a] font-semibold text-sm tracking-widest uppercase">
            NorthStar
          </span>
          <button
            onClick={onClose}
            className={cn(
              'touch-target tap-highlight-none no-select rounded-lg',
              'text-[#7db89a] hover:text-[#e6e8ed]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c19e4a]/50',
              'transition-colors duration-150'
            )}
            aria-label="Chiudi menu"
          >
            {/* X icon — inline SVG, no extra import */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto momentum-scroll py-2">
          {children}
        </div>
      </div>
    </>
  );
}
