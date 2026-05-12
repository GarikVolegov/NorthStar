import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CtaProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  icon?: ReactNode;
  href?: string;
}

export function Cta({ children, variant = 'primary', size = 'default', icon, href, className, ...props }: CtaProps) {
  const Component = href ? 'a' : Button;
  const extraProps = href ? { href } : {};

  return (
    <Component
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
        size === 'sm' && 'text-xs px-3 py-1.5 rounded-md',
        size === 'default' && 'text-sm px-4 py-2 rounded-lg',
        size === 'lg' && 'text-base px-6 py-3 rounded-xl',
        className,
      )}
      {...extraProps}
      {...(props as any)}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </Component>
  );
}
