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
  border:       "#1b2033",   // hsl(226 26% 16%)

  // ─ Cards
  card:         "#131621",   // hsl(226 27% 10%)
  cardBorder:   "#252a3c",   // hsl(226 24% 19%)

  // ─ Popovers
  popover:      "#161929",   // hsl(226 30% 12%)
  popoverBorder:"#272d40",   // hsl(226 24% 20%)

  // ─ Primary / Champagne Gold
  primary:      "#c19e4a",   // hsl( 43 44% 57%)
  primaryLight: "#d4ba7c",   // hsl( 43 44% 72%)
  primaryDark:  "#7d6827",   // hsl( 43 44% 38%)
  primaryFg:    "#0b0d12",   // hsl(224 24%  7%)

  // ─ Secondary
  secondary:    "#1c2133",   // hsl(225 23% 15%)
  secondaryFg:  "#a6aabf",   // hsl(220 10% 72%)

  // ─ Muted
  muted:        "#171b28",   // hsl(223 26% 12%)
  mutedFg:      "#7a7f96",   // hsl(220  8% 54%)

  // ─ Accent
  accent:       "#1c2133",   // hsl(225 23% 15%)
  accentFg:     "#e6e8ed",

  // ─ Destructive
  destructive:  "#c0716b",   // hsl(  4 39% 59%)
  destructiveFg:"#0b0d12",

  // ─ Semantic palette
  info:         "#7a99b6",
  success:      "#8cb09f",
  warning:      "#b89e63",
  danger:       "#c0716b",
  infoSurface:    "rgba(122, 153, 182, 0.08)",
  successSurface: "rgba(140, 176, 159, 0.08)",
  warningSurface: "rgba(184, 158, 99, 0.08)",
  dangerSurface:  "rgba(192, 113, 107, 0.08)",

  // ─ Brand (Champagne Gold)
  brand:        "#c19e4a",
  brandLight:   "#d4ba7c",
  brandDark:    "#7d6827",
  brandBorder:  "#95783f",
  brandSurface: "rgba(193, 158, 74, 0.12)",
  brandFg:      "#0b0d12",

  // ─ Growth (Sage Green)
  growth:       "#7db89a",   // hsl(152 26% 62%)
  growthLight:  "#a3cfbc",
  growthDark:   "#4e836a",
  growthBorder: "#457560",
  growthSurface:"rgba(125, 184, 154, 0.12)",
  growthFg:     "#0b0d12",

  // ─ Chart palette
  chart1:       "#c19e4a",   // gold
  chart2:       "#7db89a",   // sage
  chart3:       "#7a99b6",   // slate hsl(210 26% 60%)
  chart4:       "#c07c5e",   // terra hsl(18 40% 56%)
  chart5:       "#9f6a85",   // vino  hsl(330 20% 52%)
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  sans:  "'Inter', system-ui, sans-serif",
  serif: "'Playfair Display', Georgia, serif",
  mono:  "ui-monospace, 'Cascadia Code', monospace",
} as const;

export const radius = {
  sm: "0.5rem",      // 8px  - chip
  md: "0.625rem",    // 10px - small buttons
  lg: "0.75rem",     // 12px - default token
  xl: "1rem",        // 16px - big cards
  "2xl": "1rem",     // 16px - app cards
  full: "9999px",
} as const;

export const spacing = {
  1: "0.25rem", // 4px
  2: "0.5rem",  // 8px - gap micro
  3: "0.75rem", // 12px - gap chips
  4: "1rem",    // 16px - gap base
  5: "1.25rem", // 20px
  6: "1.5rem",  // 24px - card padding
  8: "2rem",    // 32px
  12: "3rem",   // 48px - mobile section
  16: "4rem",   // 64px - desktop section
} as const;

export const shadows = {
  sm: "0 12px 28px -18px rgba(0, 0, 0, 0.76), 0 3px 8px -4px rgba(0, 0, 0, 0.66)",
  md: "0 20px 48px -26px rgba(0, 0, 0, 0.82), 0 8px 18px -10px rgba(0, 0, 0, 0.70)",
  lg: "0 30px 72px -34px rgba(0, 0, 0, 0.86), 0 12px 28px -14px rgba(0, 0, 0, 0.72)",
  xl: "0 40px 96px -42px rgba(0, 0, 0, 0.90), 0 18px 42px -20px rgba(0, 0, 0, 0.76)",
  glowPrimary: "0 0 0 1px rgba(193, 158, 74, 0.24), 0 22px 64px -26px rgba(193, 158, 74, 0.45)",
  glowGrowth: "0 0 0 1px rgba(125, 184, 154, 0.22), 0 22px 64px -26px rgba(125, 184, 154, 0.36)",
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
