export interface LogoPreset {
  id: string;
  label: string;
  description: string;
  assetUrl: string;
  notificationIconUrl: string;
  badgeUrl: string;
  nativeIconName: string;
}

export const DEFAULT_LOGO_PRESET_ID = "northstar";

export const LOGO_PRESETS = [
  {
    id: "northstar",
    label: "Icona Classica",
    description: "Bussola storica NorthStar con stella dorata.",
    assetUrl: "/logo.svg",
    notificationIconUrl: "/logo.svg",
    badgeUrl: "/favicon.svg",
    nativeIconName: "AppIcon",
  },
  {
    id: "minimal-flat",
    label: "Minimal Flat",
    description: "Segno essenziale, pulito e leggibile.",
    assetUrl: "/brand/logo-minimal-flat.svg",
    notificationIconUrl: "/brand/logo-minimal-flat.svg",
    badgeUrl: "/brand/logo-minimal-flat.svg",
    nativeIconName: "AppIconMinimalFlat",
  },
  {
    id: "abstract-spark",
    label: "Abstract Spark",
    description: "Scintille astratte intorno alla stella guida.",
    assetUrl: "/brand/logo-abstract-spark.svg",
    notificationIconUrl: "/brand/logo-abstract-spark.svg",
    badgeUrl: "/brand/logo-abstract-spark.svg",
    nativeIconName: "AppIconAbstractSpark",
  },
  {
    id: "constellation",
    label: "Constellation",
    description: "Rotta stellare con dettagli da mappa celeste.",
    assetUrl: "/brand/logo-constellation.svg",
    notificationIconUrl: "/brand/logo-constellation.svg",
    badgeUrl: "/brand/logo-constellation.svg",
    nativeIconName: "AppIconConstellation",
  },
  {
    id: "lente-gold",
    label: "Lente Gold",
    description: "Medaglione dorato con lente centrale.",
    assetUrl: "/brand/logo-lente-gold.svg",
    notificationIconUrl: "/brand/logo-lente-gold.svg",
    badgeUrl: "/brand/logo-lente-gold.svg",
    nativeIconName: "AppIconLenteGold",
  },
  {
    id: "compass-nav",
    label: "Compass Nav.",
    description: "Rosa dei venti con cardinali evidenti.",
    assetUrl: "/brand/logo-compass-nav.svg",
    notificationIconUrl: "/brand/logo-compass-nav.svg",
    badgeUrl: "/brand/logo-compass-nav.svg",
    nativeIconName: "AppIconCompassNav",
  },
  {
    id: "ethereal-glow",
    label: "Ethereal Glow",
    description: "Bagliore morbido per un'icona piu luminosa.",
    assetUrl: "/brand/logo-ethereal-glow.svg",
    notificationIconUrl: "/brand/logo-ethereal-glow.svg",
    badgeUrl: "/brand/logo-ethereal-glow.svg",
    nativeIconName: "AppIconEtherealGlow",
  },
  {
    id: "geometric",
    label: "Geometric",
    description: "Stella geometrica a facce dorate.",
    assetUrl: "/brand/logo-geometric.svg",
    notificationIconUrl: "/brand/logo-geometric.svg",
    badgeUrl: "/brand/logo-geometric.svg",
    nativeIconName: "AppIconGeometric",
  },
  {
    id: "filigree",
    label: "Filigree",
    description: "Bussola con anello ornamentale fine.",
    assetUrl: "/brand/logo-filigree.svg",
    notificationIconUrl: "/brand/logo-filigree.svg",
    badgeUrl: "/brand/logo-filigree.svg",
    nativeIconName: "AppIconFiligree",
  },
  {
    id: "dynamic-motion",
    label: "Dynamic Motion",
    description: "Raggio direzionale con senso di movimento.",
    assetUrl: "/brand/logo-dynamic-motion.svg",
    notificationIconUrl: "/brand/logo-dynamic-motion.svg",
    badgeUrl: "/brand/logo-dynamic-motion.svg",
    nativeIconName: "AppIconDynamicMotion",
  },
  {
    id: "digital-glitch",
    label: "Digital Glitch",
    description: "Variante digitale con tracce frammentate.",
    assetUrl: "/brand/logo-digital-glitch.svg",
    notificationIconUrl: "/brand/logo-digital-glitch.svg",
    badgeUrl: "/brand/logo-digital-glitch.svg",
    nativeIconName: "AppIconDigitalGlitch",
  },
  {
    id: "dark-mode",
    label: "Dark Mode",
    description: "Stella minima su fondo nero profondo.",
    assetUrl: "/brand/logo-dark-mode.svg",
    notificationIconUrl: "/brand/logo-dark-mode.svg",
    badgeUrl: "/brand/logo-dark-mode.svg",
    nativeIconName: "AppIconDarkMode",
  },
] as const satisfies readonly LogoPreset[];

export type LogoPresetId = (typeof LOGO_PRESETS)[number]["id"];

export const DEFAULT_LOGO_PRESET = LOGO_PRESETS[0]!;

const LEGACY_PRESET_ID_ALIASES: Record<string, LogoPresetId> = {
  aurora: "ethereal-glow",
  compass: "compass-nav",
};

export function findLogoPreset(id: unknown): LogoPreset | null {
  if (typeof id !== "string") return null;
  const presetId = LEGACY_PRESET_ID_ALIASES[id] ?? id;
  return LOGO_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function resolveLogoPreset(id: unknown): LogoPreset {
  return findLogoPreset(id) ?? DEFAULT_LOGO_PRESET;
}
