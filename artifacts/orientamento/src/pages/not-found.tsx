import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4 bg-card rounded-2xl border border-border p-8 text-center">
        <div className="flex justify-center mb-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">{t("notFound.title")}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t("notFound.subtitle")}</p>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
          {t("notFound.goHome")}
        </Link>
      </div>
    </div>
  );
}
