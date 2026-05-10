import {
  Code2, Shield, BarChart2, CreditCard, Leaf, Heart, BookOpen,
  TrendingUp, ShoppingBag, Truck, Settings, MapPin, Briefcase,
  Users, Palette, Home, Wheat, Gamepad2, Scale, FlaskConical,
  BarChart, HelpCircle, type LucideProps,
} from "lucide-react";
import { cn } from "./utils";

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  "code":            Code2,
  "shield":          Shield,
  "bar-chart-2":     BarChart2,
  "credit-card":     CreditCard,
  "leaf":            Leaf,
  "heart":           Heart,
  "book-open":       BookOpen,
  "trending-up":     TrendingUp,
  "shopping-bag":    ShoppingBag,
  "truck":           Truck,
  "settings":        Settings,
  "map-pin":         MapPin,
  "briefcase":       Briefcase,
  "users":           Users,
  "palette":         Palette,
  "home":            Home,
  "wheat":           Wheat,
  "gamepad-2":       Gamepad2,
  "scale":           Scale,
  "flask-conical":   FlaskConical,
  "bar-chart":       BarChart,
};

interface SectorIconProps {
  name: string | null | undefined;
  className?: string;
  size?: number;
}

export function SectorIcon({ name, className, size = 28 }: SectorIconProps) {
  const Icon = name ? (ICON_MAP[name] ?? HelpCircle) : HelpCircle;
  return <Icon className={cn("shrink-0", className)} size={size} strokeWidth={1.5} />;
}

export const RIASEC_LABELS: Record<string, { label: string; desc: string }> = {
  R: { label: "Realistico",    desc: "Pratico, manuale, tecnico" },
  I: { label: "Investigativo", desc: "Analitico, curioso, scientifico" },
  A: { label: "Artistico",     desc: "Creativo, espressivo, originale" },
  S: { label: "Sociale",       desc: "Empatico, comunicativo, di aiuto" },
  E: { label: "Imprenditivo",  desc: "Persuasivo, ambizioso, leader" },
  C: { label: "Convenzionale", desc: "Organizzato, preciso, metodico" },
};
