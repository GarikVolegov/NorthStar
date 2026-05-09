/**
 * useMobileNav.ts — Phase 1
 *
 * Controls the mobile drawer/sheet navigation state.
 * Single source of truth for open/close so all consumers
 * (MobileDrawer, Navbar trigger, overlay) stay in sync.
 *
 * Usage:
 *   const { isOpen, open, close, toggle } = useMobileNav();
 *
 * Closes automatically:
 *   - On route change (pass location as dependency)
 *   - On Escape key
 *   - On backdrop click (handled by MobileDrawer)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMobileNavReturn {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
  toggle: () => void;
}

export function useMobileNav(closeOnRouteChange?: string): UseMobileNavReturn {
  const [isOpen, setIsOpen] = useState(false);
  const prevRoute = useRef(closeOnRouteChange);

  // Close on route change
  useEffect(() => {
    if (closeOnRouteChange !== prevRoute.current) {
      prevRoute.current = closeOnRouteChange;
      setIsOpen(false);
    }
  }, [closeOnRouteChange]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const open   = useCallback(() => setIsOpen(true),  []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  return { isOpen, open, close, toggle };
}
