import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2, Pencil, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EditPanel } from "./CvEditorComponents";
import type { GeneratedCv } from "./cvTypes";
import { formatSavedAt } from "./cvUtils";

type CvSaveStatus = "idle" | "saving" | "saved" | "error";

type CvEditShellProps = {
  cv: GeneratedCv;
  onChange: (cv: GeneratedCv) => void;
  save: () => void | Promise<void>;
  saveStatus: CvSaveStatus;
  hasUnsavedChanges: boolean;
  lastSavedAt: string | null;
};

export function CvDesktopEditShell({
  cv,
  onChange,
  save,
  saveStatus,
  hasUnsavedChanges,
  lastSavedAt,
}: CvEditShellProps) {
  const { t } = useTranslation();

  return (
    <div className="w-100 shrink-0 overflow-y-auto border-r bg-background p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b">
        <Pencil className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm text-foreground">
          {t("cv.editCv")}
        </h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {t("cv.livePreview")}
        </span>
      </div>
      <EditPanel cv={cv} onChange={onChange} />
      <div className="mt-4 pt-4 border-t sticky bottom-0 bg-background pb-2">
        <Button
          className={cn(
            "w-full rounded-xl gap-2",
            saveStatus === "saved" && "bg-emerald-600 hover:bg-emerald-700",
          )}
          onClick={save}
          disabled={
            saveStatus === "saving" ||
            (!hasUnsavedChanges && saveStatus !== "idle")
          }
        >
          {saveStatus === "saving" && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          {saveStatus === "saved" && <CheckCircle2 className="w-4 h-4" />}
          {saveStatus === "error" && <AlertCircle className="w-4 h-4" />}
          {saveStatus === "idle" && <Save className="w-4 h-4" />}
          {saveStatus === "saving"
            ? t("cv.savingFull")
            : saveStatus === "saved"
              ? t("cv.savedFull")
              : saveStatus === "error"
                ? t("cv.saveErrorFull")
                : t("cv.saveChanges")}
        </Button>
        {hasUnsavedChanges && saveStatus === "idle" && (
          <p className="text-center text-xs text-amber-600 mt-2">
            {t("cv.unsavedNote")}
          </p>
        )}
        {lastSavedAt && saveStatus !== "saving" && (
          <p className="text-center text-xs text-muted-foreground mt-1.5">
            {t("cv.lastSaved", { when: formatSavedAt(lastSavedAt) })}
          </p>
        )}
      </div>
    </div>
  );
}

export function CvMobileEditShell({
  cv,
  onChange,
  save,
  saveStatus,
  lastSavedAt,
}: CvEditShellProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center gap-2 mb-4 pb-3 border-b">
        <Pencil className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">{t("cv.editCvShort")}</h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {t("cv.goToPreview")}
        </span>
      </div>
      <EditPanel cv={cv} onChange={onChange} />
      <div className="mt-4 pt-4 border-t">
        <Button
          className={cn(
            "w-full rounded-xl gap-2",
            saveStatus === "saved" && "bg-emerald-600",
          )}
          onClick={save}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveStatus === "saving"
            ? t("cv.saving")
            : saveStatus === "saved"
              ? t("cv.saved")
              : t("cv.saveChanges")}
        </Button>
        {lastSavedAt && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            {t("cv.lastSaved", { when: formatSavedAt(lastSavedAt) })}
          </p>
        )}
      </div>
    </>
  );
}
