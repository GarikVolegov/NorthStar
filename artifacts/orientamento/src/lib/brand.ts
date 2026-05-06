export const BRAND = {
  colors: {
    /* Dark navy backgrounds */
    background:     "#08192e",
    backgroundCard: "#0c2040",
    backgroundMuted:"#0f2a52",
    border:         "#1a3660",
    borderSubtle:   "#122d52",

    foreground:     "#f5f5f5",
    foregroundMuted:"#7a9fc0",
    foregroundDim:  "#4a6e90",

    /* Primary — Gold #D4AF37 */
    primary:        "#D4AF37",
    primaryDark:    "#a8891c",
    primaryLight:   "#e8cc6a",
    primaryFg:      "#08192e",

    brand:          "#D4AF37",
    brandDark:      "#a8891c",
    brandLight:     "#f0d96a",
    brandFg:        "#08192e",

    /* Growth accent — Light Green #A8D5BA */
    growth:         "#A8D5BA",
    growthDark:     "#5aab7a",
    growthLight:    "#d4ede0",
    growthFg:       "#08192e",

    /* Navy — for hero/header surfaces */
    navy:           "#002855",
    navyLight:      "#003d7a",
    navyDark:       "#001a3d",

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
    sm:  "0 1px 3px 0 rgba(0,20,60,0.5)",
    md:  "0 4px 12px 0 rgba(0,20,60,0.4)",
    lg:  "0 8px 24px 0 rgba(0,20,60,0.6)",
    glow:"0 0 24px 0 rgba(212,175,55,0.28)",
    growthGlow: "0 0 20px 0 rgba(168,213,186,0.25)",
  },
} as const;

export type BrandColors = typeof BRAND.colors;
