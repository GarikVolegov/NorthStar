/**
 * NorthStar Design Tokens — TypeScript
 *
 * Usare questi valori per:
 * - Inline styles dinamici
 * - Calcoli JavaScript (es. canvas, charting libraries)
 * - Unit test di colori
 * - Generazione di temi Stripe Elements
 *
 * I valori HEX corrispondono esattamente ai token CSS in northstar-theme.css
 */

export const colors = {
  // ─ Background
  background:   "#0e1018",   // hsl(224 24%  8%)
  foreground:   "#e6e8ed",   // hsl(220 14% 93%)
  border:       "#1e2233",   // hsl(224 18% 19%)

  // ─ Cards
  card:         "#131621",   // hsl(224 22% 11%)
  cardBorder:   "#1f2438",   // hsl(224 18% 22%)

  // ─ Popovers
  popover:      "#161929",   // hsl(224 22% 13%)
  popoverBorder:"#202640",   // hsl(224 18% 24%)

  // ─ Primary / Champagne Gold
  primary:      "#c19e4a",   // hsl( 43 44% 57%)
  primaryLight: "#d4ba7c",   // hsl( 43 44% 72%)
  primaryDark:  "#7d6827",   // hsl( 43 44% 38%)
  primaryFg:    "#0b0d12",   // hsl(224 24%  7%)

  // ─ Secondary
  secondary:    "#1a1f30",   // hsl(224 18% 15%)
  secondaryFg:  "#a6aabf",   // hsl(220 10% 72%)

  // ─ Muted
  muted:        "#171b28",   // hsl(224 18% 13%)
  mutedFg:      "#7a7f96",   // hsl(220  8% 54%)

  // ─ Accent
  accent:       "#1c2133",   // hsl(224 18% 16%)
  accentFg:     "#e6e8ed",

  // ─ Destructive
  destructive:  "#d94f45",   // hsl(  4 62% 52%)
  destructiveFg:"#ffffff",

  // ─ Brand (Champagne Gold)
  brand:        "#c19e4a",
  brandLight:   "#d4ba7c",
  brandDark:    "#7d6827",
  brandBorder:  "#95783f",
  brandFg:      "#0b0d12",

  // ─ Growth (Sage Green)
  growth:       "#7db89a",   // hsl(152 26% 62%)
  growthLight:  "#a3cfbc",
  growthDark:   "#4e836a",
  growthBorder: "#457560",
  growthFg:     "#0b0d12",

  // ─ Chart palette
  chart1:       "#c19e4a",   // gold
  chart2:       "#7db89a",   // green
  chart3:       "#5a9fd4",   // blue   hsl(210 55% 58%)
  chart4:       "#9b80cc",   // purple hsl(268 38% 60%)
  chart5:       "#d96e66",   // red    hsl(  4 52% 56%)
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  sans:  "'Inter', system-ui, sans-serif",
  serif: "'Playfair Display', Georgia, serif",
  mono:  "ui-monospace, 'Cascadia Code', monospace",
} as const;

export const radius = {
  sm: "0.5rem",
  md: "0.625rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;

/** Stripe Elements appearance config — usa i token brand */
export const stripeElementsAppearance = {
  theme: "night" as const,
  variables: {
    colorBackground:      colors.card,
    colorText:            colors.foreground,
    colorTextPlaceholder: colors.mutedFg,
    colorPrimary:         colors.primary,
    colorDanger:          colors.destructive,
    borderRadius:         radius.md,
    fontFamily:           fonts.sans,
  },
  rules: {
    ".Input": {
      borderColor:     colors.border,
      backgroundColor: colors.muted,
      boxShadow:       "none",
    },
    ".Input:focus": {
      borderColor: colors.primary,
      boxShadow:   `0 0 0 1px ${colors.primary}`,
    },
    ".Label": { color: colors.mutedFg },
  },
} as const;
