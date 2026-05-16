import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

const NO_BACK_PATHS = ["/", "/test", "/news", "/settori", "/premium", "/profilo", "/contatti", "/crescita"];

export function BackButton() {
  const [location] = useLocation();
  const { t } = useTranslation();

  if (NO_BACK_PATHS.includes(location)) return null;

  return (
    <div className="container mx-auto px-4 md:px-6 pt-4">
      <button
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 lefty:rotate-180 lefty:group-hover:translate-x-0.5 transition-transform" />
        {t("nav.back", { defaultValue: "Indietro" })}
      </button>
    </div>
  );
}
