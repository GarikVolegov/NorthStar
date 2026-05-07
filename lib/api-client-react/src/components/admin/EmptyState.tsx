/**
 * EmptyState
 *
 * Componente generico per le sezioni admin senza dati.
 * Supporta un action button opzionale.
 */
import React from "react";

export interface EmptyStateProps {
  icon?:        string;       // emoji
  title:        string;
  description?: string;
  action?:      { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      {icon && <span className="text-5xl" aria-hidden>{icon}</span>}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
