import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FormGroupProps {
  label?: string;
  description?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
  id?: string;
}

export function FormGroup({ label, description, error, children, required, className, id }: FormGroupProps) {
  return (
    <div id={id} className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {children}
      {error && (
        <p className="text-xs text-destructive font-medium">{error}</p>
      )}
    </div>
  );
}
