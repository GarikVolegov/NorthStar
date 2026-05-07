// Chart colors aligned to NorthStar brand design tokens
export const CHART_COLORS = {
  primary:     "#c19e4a", // Champagne Gold — main brand
  primaryLight:"#d8bc7a", // Gold light — secondary series
  growth:      "#7db89a", // Sage Green — positive/growth
  growthLight: "#b2d4c4", // Sage Green light
  blue:        "#5a9fd4", // Cool Blue — informational / data
  muted:       "#4a5368", // Foreground dim — neutral/background series
  destructive: "#d94f45", // Soft Red — negative/error series
  neutral:     "#7e8a9e", // Foreground muted
};

export const CHART_DEFAULTS = {
  strokeWidth: 2,
  dot: false,
  animationDuration: 600,
  animationEasing: "ease-out" as const,
};
