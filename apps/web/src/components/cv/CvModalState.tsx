import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CvData } from "./CvSection";
import { formatSavedAt } from "./cvUtils";

export function CvLoadingState({ cvData }: { cvData: CvData | null }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center w-full gap-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-primary animate-pulse" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">{t("cv.generating")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("cv.generatingDesc", {
            cvSuffix: cvData ? t("cv.generatingDescWithCv") : "",
          })}
        </p>
      </div>
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

export function CvErrorState({
  error,
  retry,
}: {
  error: string;
  retry: () => void | Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <div className="max-w-md mx-auto mt-20 text-center w-full">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-destructive" />
      </div>
      <p className="font-semibold text-foreground mb-2">
        {t("cv.errorGenerating")}
      </p>
      <p className="text-sm text-muted-foreground mb-5">{error}</p>
      <Button onClick={retry} className="rounded-full">
        {t("cv.retry")}
      </Button>
    </div>
  );
}

export function CvModalFooter({
  isEditing,
  hasUnsavedChanges,
  lastSavedAt,
}: {
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: string | null;
}) {
  const { t } = useTranslation();

  return (
    <div className="text-center py-2 text-xs text-white/60 bg-black/25 print:hidden">
      {isEditing
        ? hasUnsavedChanges
          ? `● ${t("cv.footerUnsaved")}`
          : t("cv.footerEditing")
        : lastSavedAt
          ? t("cv.footerSavedAt", { when: formatSavedAt(lastSavedAt) })
          : t("cv.footerHelp")}
    </div>
  );
}
