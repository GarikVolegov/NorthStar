import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function PremiumSuccess() {
  const { t } = useTranslation();

  return (
    <div className="container max-w-lg mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
        <CheckCircle2 className="w-12 h-12" />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium text-primary uppercase tracking-wider">{t("premiumSuccess.badge")}</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">
        {t("premiumSuccess.activated")}
      </h1>
      <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
        {t("premiumSuccess.desc")}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
        <Button asChild size="lg" className="rounded-full px-8 h-13">
          <Link href="/">
            {t("premiumSuccess.exploreNow")} <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="rounded-full px-8">
          <Link href="/test">{t("premiumSuccess.retakeTest")}</Link>
        </Button>
      </div>
    </div>
  );
}
