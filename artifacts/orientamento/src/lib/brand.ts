export const BRAND = {
  colors: {
    /* Deep navy-slate backgrounds */
    background:     "#0d1120",
    backgroundCard: "#131828",
    backgroundMuted:"#181e2e",
    border:         "#252e45",
    borderSubtle:   "#1e2638",

    foreground:     "#eaecf2",
    foregroundMuted:"#7e8a9e",
    foregroundDim:  "#4a5368",

    /* Primary — Champagne Gold (refined, desaturated) */
    primary:        "#c19e4a",
    primaryDark:    "#8f7230",
    primaryLight:   "#d8bc7a",
    primaryFg:      "#0d1120",

    brand:          "#c19e4a",
    brandDark:      "#8f7230",
    brandLight:     "#d8bc7a",
    brandFg:        "#0d1120",

    /* Growth accent — Sage Green */
    growth:         "#7db89a",
    growthDark:     "#4e8068",
    growthLight:    "#b2d4c4",
    growthFg:       "#0d1120",

    /* Hero dark surface */
    heroDark:       "#0b0f1c",
    heroDark2:      "#090d18",

    /* Neutral */
    neutralGray:    "#e2e8f0",
    white:          "#FFFFFF",

    destructive:    "#e05252",
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
    sm:  "0 1px 3px 0 rgba(0,0,0,0.55)",
    md:  "0 4px 12px 0 rgba(0,0,0,0.48)",
    lg:  "0 8px 24px 0 rgba(0,0,0,0.62)",
    glow:"0 0 24px 0 rgba(193,158,74,0.20)",
    growthGlow: "0 0 18px 0 rgba(125,184,154,0.18)",
  },
} as const;

export type BrandColors = typeof BRAND.colors;
