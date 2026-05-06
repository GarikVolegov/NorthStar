export const BRAND = {
  colors: {
    background:     "#0d0d0d",
    backgroundCard: "#111111",
    backgroundMuted:"#161616",
    border:         "#222222",
    borderSubtle:   "#1a1a1a",

    foreground:     "#f5f5f5",
    foregroundMuted:"#888888",
    foregroundDim:  "#555555",

    primary:        "#4ade80",
    primaryDark:    "#22c55e",
    primaryLight:   "#86efac",
    primaryFg:      "#0a0a0a",

    brand:          "#4ade80",
    brandDark:      "#16a34a",
    brandLight:     "#bbf7d0",
    brandFg:        "#0a0a0a",

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
    sm:  "0 1px 3px 0 rgba(0,0,0,0.5)",
    md:  "0 4px 12px 0 rgba(0,0,0,0.4)",
    lg:  "0 8px 24px 0 rgba(0,0,0,0.6)",
    glow:"0 0 24px 0 rgba(74,222,128,0.25)",
  },
} as const;

export type BrandColors = typeof BRAND.colors;
