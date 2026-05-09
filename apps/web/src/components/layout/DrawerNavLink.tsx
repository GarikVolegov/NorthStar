/**
 * DrawerNavLink.tsx — Phase 1
 *
 * A single navigation link for use inside MobileDrawer.
 * Enforces 44px tap target, active state, and consistent
 * touch feedback (useTouchFeedback).
 *
 * Usage:
 *   <DrawerNavLink href="/dashboard" icon={<LayoutDashboard size={18} />}>
 *     Dashboard
 *   </DrawerNavLink>
 */

import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useTouchFeedback } from '@/hooks/useTouchFeedback';

interface DrawerNavLinkProps {
  href:      string;
  icon?:     React.ReactNode;
  children:  React.ReactNode;
  onClick?:  () => void;
  className?: string;
}

export function DrawerNavLink({ href, icon, children, onClick, className }: DrawerNavLinkProps) {
  const [location, navigate] = useLocation();
  const isActive = location === href;
  const { handlers, isPressed } = useTouchFeedback({ vibrationMs: 30 });

  const handleClick = () => {
    navigate(href);
    onClick?.();
  };

  return (
    <button
      {...handlers}
      onClick={handleClick}
      className={cn(
        // Touch target garantito
        'touch-target-full tap-highlight-none no-select',
        // Layout
        'flex items-center gap-3 px-5 w-full text-left',
        // Typography
        'text-sm font-medium',
        // Transizioni
        'transition-all duration-150',
        // Stato normale
        !isActive && 'text-[#7db89a] hover:text-[#e6e8ed] hover:bg-[#1a1d2a]',
        // Stato attivo (rotta corrente)
        isActive && 'text-[#c19e4a] bg-[#c19e4a]/10 border-l-2 border-[#c19e4a]',
        // Feedback tattile visivo
        isPressed && 'scale-[0.98] bg-[#1a1d2a]',
        className
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon && (
        <span className={cn(
          'flex-shrink-0 transition-colors duration-150',
          isActive ? 'text-[#c19e4a]' : 'text-[#7db89a]'
        )}>
          {icon}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}
