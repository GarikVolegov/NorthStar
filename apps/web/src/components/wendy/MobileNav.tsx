/**
 * MobileNav — Bottom sheet di navigazione mobile-native.
 *
 * Pattern: bottom sheet che sale dal basso quando isOpen=true.
 * Usato per sostituire i menu a tendina tradizionali su viewport mobile.
 *
 * CARATTERISTICHE:
 *   - Overlay semi-trasparente che chiude il drawer al click
 *   - Transizione translate-y CSS per performance GPU (no JS animation loop)
 *   - Body scroll bloccato quando aperto
 *   - Tap target minimo 44px su ogni item (Apple HIG / Material Design)
 *   - Accessibilità: role="dialog", aria-modal, aria-label
 *
 * USO:
 *   <MobileNav
 *     isOpen={navOpen}
 *     onClose={() => setNavOpen(false)}
 *     items={[
 *       { label: "Wendy",    href: "/wendy",    icon: "🧡" },
 *       { label: "Profilo",  href: "/profile",  icon: "👤" },
 *       { label: "Scopri",   href: "/discover", icon: "🔭" },
 *     ]}
 *   />
 */
import React, { useEffect } from "react";

export interface NavItem {
  label: string;
  href:  string;
  icon?: string;
}

interface MobileNavProps {
  isOpen:  boolean;
  onClose: () => void;
  items:   NavItem[];
}

export function MobileNav({ isOpen, onClose, items }: MobileNavProps) {
  // Blocca lo scroll del body quando il drawer è aperto
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay semi-trasparente — chiude il drawer al tap fuori */}
      <div
        className={[
          "fixed inset-0 z-40 bg-black/50",
          "transition-opacity duration-300",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/*
       * Bottom sheet — sale dal basso su mobile.
       * translate-y-full = nascosto; translate-y-0 = visibile.
       * Usa GPU-accelerated CSS transform per 60fps su device low-end.
       */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigazione principale"
        className={[
          "fixed bottom-0 left-0 right-0 z-50",
          "rounded-t-2xl bg-background border-t border-border shadow-xl",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        {/* Handle visivo — indica che il drawer può essere trascinato */}
        <div className="mx-auto mt-3 mb-4 h-1 w-10 rounded-full bg-muted" />

        <nav className="flex flex-col px-4 pb-8 gap-1">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={[
                "flex items-center gap-3",
                "min-h-[44px] px-3 py-2 rounded-xl", // tap target 44px obbligatorio
                "text-sm font-medium text-foreground",
                "hover:bg-accent active:bg-accent/80",
                "transition-colors duration-150",
              ].join(" ")}
            >
              {item.icon && (
                <span className="text-lg w-6 text-center shrink-0" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
