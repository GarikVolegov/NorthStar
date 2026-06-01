# 👆 Phase 1 — Touch Interaction & UI

> Documento tecnico dei cambiamenti implementati nella Fase 1.
> Stato: **IMPLEMENTATO** — Maggio 2026

---

## File introdotti

| File | Tipo | Scopo |
|------|------|-------|
| `apps/web/src/index.css` | Aggiornato | Token CSS touch, utilities globali mobile-first |
| `apps/web/src/hooks/useTouchFeedback.ts` | Nuovo | Vibrazione + stato `isPressed` per qualsiasi elemento |
| `apps/web/src/hooks/useMobileNav.ts` | Nuovo | Stato drawer: open/close/toggle + body scroll lock |
| `apps/web/src/components/layout/MobileDrawer.tsx` | Nuovo | Drawer slide-in con backdrop, focus trap, aria-modal |
| `apps/web/src/components/layout/DrawerNavLink.tsx` | Nuovo | Link 44px con `useTouchFeedback` + stato active |
| `apps/web/src/lib/utils.ts` | Nuovo | `cn()` — unico helper per classi Tailwind condizionali |

---

## CSS globals (`index.css`)

### Token aggiunti

```css
--touch-target-min: 44px;   /* WCAG 2.5.5 + Apple HIG */
--spacing-page-x:   1rem;   /* padding orizzontale mobile */
--spacing-page-y:   1.25rem;
--safe-area-bottom: env(safe-area-inset-bottom, 0px);
--safe-area-top:    env(safe-area-inset-top, 0px);
```

### Utility classes

| Classe | Uso |
|--------|-----|
| `.touch-target` | Icone, bottoni piccoli: garantisce 44×44px |
| `.touch-target-full` | CTA a tutta larghezza, voci di lista |
| `.tap-highlight-none` | Rimuove flash blu su tap Android |
| `.momentum-scroll` | Scroll fluido iOS in container overflow |
| `.no-select` | Previene selezione accidentale durante swipe |
| `.page-padding` | Padding orizzontale mobile-first (responsive) |
| `.pb-safe` | Padding bottom che rispetta safe area iPhone |

### Performance — Glass panel su mobile

```css
@media (max-width: 767px) {
  .glass-panel {
    backdrop-filter: none !important;
    background: rgba(26, 29, 42, 0.95);
  }
}
```
Disabilita il `backdrop-filter` su mobile (GPU deboli), allineato con
`.brain/40_Agent_Context/rules/FRONTEND_RULES.md §3.3`.

---

## `useTouchFeedback` — Come usarlo

```tsx
import { useTouchFeedback } from '@/hooks/useTouchFeedback';
import { cn } from '@/lib/utils';

function MyButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const { handlers, isPressed } = useTouchFeedback({ vibrationMs: 40 });

  return (
    <button
      {...handlers}
      onClick={onClick}
      className={cn(
        'touch-target-full tap-highlight-none rounded-xl px-4 py-3',
        'bg-[#1a1d2a] text-[#e6e8ed] transition-all duration-150',
        'hover:bg-[#c19e4a]/10 focus-visible:ring-2 focus-visible:ring-[#c19e4a]/50',
        isPressed && 'scale-[0.97] bg-[#c19e4a]/20'
      )}
    >
      {children}
    </button>
  );
}
```

**Opzioni disponibili:**

| Opzione | Default | Descrizione |
|---------|---------|-------------|
| `vibrationMs` | `40` | Durata vibrazione in ms. `0` = disabilita |
| `onPress` | — | Callback al touch start |
| `onRelease` | — | Callback al touch end |
| `disabled` | `false` | Disabilita tutto il feedback |

---

## `MobileDrawer` + `useMobileNav` — Come usarli

```tsx
import { useMobileNav } from '@/hooks/useMobileNav';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { DrawerNavLink } from '@/components/layout/DrawerNavLink';
import { useLocation } from 'wouter';

function Navbar() {
  const [location] = useLocation();
  // Passa location per chiudere il drawer al cambio rotta
  const nav = useMobileNav(location);

  return (
    <header>
      {/* Hamburger button — visibile solo su mobile */}
      <button
        onClick={nav.toggle}
        className="touch-target tap-highlight-none md:hidden"
        aria-label={nav.isOpen ? 'Chiudi menu' : 'Apri menu'}
        aria-expanded={nav.isOpen}
      >
        {/* Lucide Menu icon o SVG inline */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Drawer — montato sempre, visibile solo quando isOpen */}
      <MobileDrawer isOpen={nav.isOpen} onClose={nav.close}>
        <DrawerNavLink href="/dashboard" onClick={nav.close}>
          Dashboard
        </DrawerNavLink>
        <DrawerNavLink href="/settori" onClick={nav.close}>
          Settori
        </DrawerNavLink>
        <DrawerNavLink href="/percorso" onClick={nav.close}>
          Il mio percorso
        </DrawerNavLink>
        {/* ... altre voci */}
      </MobileDrawer>
    </header>
  );
}
```

---

## `DrawerNavLink` — Props

| Prop | Tipo | Obbligatorio | Descrizione |
|------|------|-------------|-------------|
| `href` | `string` | ✅ | Rotta Wouter |
| `icon` | `ReactNode` | — | Icona a sinistra del testo |
| `children` | `ReactNode` | ✅ | Testo del link |
| `onClick` | `() => void` | — | Callback extra (es: chiudere drawer) |
| `className` | `string` | — | Classi aggiuntive |

---

## Checklist Phase 1 — Ancora da fare

Questa implementazione fornisce i **primitivi**. Devi ancora applicarli
alla Navbar esistente:

- [ ] Importare `useMobileNav` + `MobileDrawer` nel file `Navbar.tsx` esistente
- [ ] Aggiungere il bottone hamburger (`md:hidden`) nella Navbar
- [ ] Aggiungere `touch-target` ai bottoni icona della `BottomNav`
- [ ] Aggiungere `tap-highlight-none no-select` a card cliccabili
- [ ] Aggiungere `page-padding` ai container pagina principali
- [ ] Verificare che tutti i bottoni CTA usino `touch-target-full`
- [ ] Auditare con DevTools: ogni elemento cliccabile ≥ 44px (layer panel)

---

_PHASE1_TOUCH_UI.md — NorthStar · Phase 1 · Maggio 2026_
