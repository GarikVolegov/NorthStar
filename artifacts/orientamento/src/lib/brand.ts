export const BRAND = {
  colors: {
    /* Dark charcoal backgrounds (warm-toned, like photo) */
    background:     "#111009",
    backgroundCard: "#1a1812",
    backgroundMuted:"#22201a",
    border:         "#2e2b22",
    borderSubtle:   "#252218",

    foreground:     "#f0ede5",
    foregroundMuted:"#8a8270",
    foregroundDim:  "#5a5545",

    /* Primary — Rich Gold #D4AF37 */
    primary:        "#D4AF37",
    primaryDark:    "#a8891c",
    primaryLight:   "#e8cc6a",
    primaryFg:      "#111009",

    brand:          "#D4AF37",
    brandDark:      "#a8891c",
    brandLight:     "#f0d96a",
    brandFg:        "#111009",

    /* Growth accent — Sage Green */
    growth:         "#8fbfa4",
    growthDark:     "#5a8a6e",
    growthLight:    "#c4dece",
    growthFg:       "#111009",

    /* Hero dark surface */
    heroDark:       "#0d0b08",
    heroDark2:      "#151310",

    /* Neutral */
    neutralGray:    "#E5E7EB",
    white:          "#FFFFFF",

    destructive:    "#ef4444",
    destructiveFg:  "#ffffff",
  },

  fonts: {
    sans:  "'Inter', system-ui, sans-serif",
    serif: "'Playfair Display', Georgia, serif",
    mono:  "ui-monospace, monospace",
  },

  radius: {
    sm:  "0.375rem",
    md:  "0.5rem",
    lg:  "0.75rem",
    xl:  "1rem",
    full:"9999px",
  },

  shadows: {
    sm:  "0 1px 3px 0 rgba(0,0,0,0.6)",
    md:  "0 4px 12px 0 rgba(0,0,0,0.5)",
    lg:  "0 8px 24px 0 rgba(0,0,0,0.7)",
    glow:"0 0 28px 0 rgba(212,175,55,0.32)",
    growthGlow: "0 0 20px 0 rgba(143,191,164,0.25)",
  },
} as const;

export type BrandColors = typeof BRAND.colors;
