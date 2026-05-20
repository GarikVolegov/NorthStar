import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BarChart2,
  Check,
  CheckCircle2,
  Clock,
  Crosshair,
  Download,
  Eye,
  History,
  Loader2,
  Mail,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { GeneratedCv } from "./cvTypes";
import { formatSavedAt } from "./cvUtils";

export type CvMobileTab = "edit" | "preview";
export type CvSaveStatus = "idle" | "saving" | "saved" | "error";

type CvToolbarProps = {
  generated: GeneratedCv | null;
  hasContent: boolean;
  lastSavedAt: string | null;
  hasUnsavedChanges: boolean;
  mobileTab: CvMobileTab;
  setMobileTab: Dispatch<SetStateAction<CvMobileTab>>;
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  saveStatus: CvSaveStatus;
  save: () => void | Promise<void>;
  showAts: boolean;
  setShowAts: Dispatch<SetStateAction<boolean>>;
  showLetter: boolean;
  setShowLetter: Dispatch<SetStateAction<boolean>>;
  showTailor: boolean;
  setShowTailor: Dispatch<SetStateAction<boolean>>;
  showVersions: boolean;
  setShowVersions: Dispatch<SetStateAction<boolean>>;
  versionsCount: number;
  generate: () => void | Promise<void>;
  loading: boolean;
  downloadPdf: () => void | Promise<void>;
  downloading: boolean;
  onClose: () => void;
};

export function CvToolbar({
  generated,
  hasContent,
  lastSavedAt,
  hasUnsavedChanges,
  mobileTab,
  setMobileTab,
  isEditing,
  setIsEditing,
  saveStatus,
  save,
  showAts,
  setShowAts,
  showLetter,
  setShowLetter,
  showTailor,
  setShowTailor,
  showVersions,
  setShowVersions,
  versionsCount,
  generate,
  loading,
  downloadPdf,
  downloading,
  onClose,
}: CvToolbarProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* -- Toolbar -- */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-background/97 border-b shadow-sm print:hidden gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground leading-tight">
              {t("cv.generatedTitle")}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {generated?.targetRole && (
                <span className="text-xs text-muted-foreground">
                  {t("cv.targetRole", { role: generated.targetRole })}
                </span>
              )}
              {lastSavedAt && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Clock className="w-2.5 h-2.5" />
                  {t("cv.savedAt", { when: formatSavedAt(lastSavedAt) })}
                </span>
              )}
              {hasUnsavedChanges && (
                <span className="text-xs text-amber-600 font-medium">
                  ● {t("cv.unsavedChanges")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mobile tab switcher */}
          {hasContent && (
            <div className="flex rounded-lg bg-muted p-0.5 md:hidden">
              <button
                onClick={() => setMobileTab("edit")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  mobileTab === "edit"
                    ? "bg-white shadow text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Pencil className="w-3 h-3" /> {t("cv.noTabMobile")}
              </button>
              <button
                onClick={() => setMobileTab("preview")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  mobileTab === "preview"
                    ? "bg-white shadow text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Eye className="w-3 h-3" /> {t("cv.previewTabMobile")}
              </button>
            </div>
          )}

          {/* Desktop: edit toggle */}
          {hasContent && (
            <Button
              size="sm"
              variant={isEditing ? "default" : "outline"}
              className="rounded-full gap-1.5 hidden md:flex"
              onClick={() => setIsEditing((v) => !v)}
            >
              {isEditing ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {t("cv.doneEdit")}
                </>
              ) : (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  {t("cv.edit")}
                </>
              )}
            </Button>
          )}

          {/* Save button ? shown when editing or there are unsaved changes */}
          {hasContent && (isEditing || hasUnsavedChanges) && (
            <Button
              size="sm"
              variant={saveStatus === "saved" ? "outline" : "default"}
              className={cn(
                "rounded-full gap-1.5",
                saveStatus === "saved" &&
                  "text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-50",
                saveStatus === "error" &&
                  "text-destructive border-destructive/30 bg-destructive/5",
              )}
              onClick={save}
              disabled={saveStatus === "saving" || saveStatus === "saved"}
            >
              {saveStatus === "saving" && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {saveStatus === "saved" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              {saveStatus === "error" && (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              {saveStatus === "idle" && <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {saveStatus === "saving"
                  ? t("cv.saving")
                  : saveStatus === "saved"
                    ? t("cv.saved")
                    : saveStatus === "error"
                      ? t("cv.saveError")
                      : t("cv.saveChanges")}
              </span>
            </Button>
          )}

          {/* ATS Score */}
          {hasContent && (
            <Button
              size="sm"
              variant={showAts ? "default" : "outline"}
              className={cn(
                "rounded-full gap-1.5",
                !showAts && "border-teal-300 text-teal-700 hover:bg-teal-50",
                showAts && "bg-teal-600 hover:bg-teal-700",
              )}
              onClick={() => {
                setShowAts((v) => !v);
                setShowLetter(false);
                setShowTailor(false);
                setShowVersions(false);
              }}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("cv.atsButton")}</span>
            </Button>
          )}

          {/* Lettera di Presentazione */}
          {hasContent && (
            <Button
              size="sm"
              variant={showLetter ? "default" : "outline"}
              className={cn(
                "rounded-full gap-1.5",
                !showLetter &&
                  "border-indigo-300 text-indigo-700 hover:bg-indigo-50",
                showLetter && "bg-indigo-600 hover:bg-indigo-700",
              )}
              onClick={() => {
                setShowLetter((v) => !v);
                setShowTailor(false);
                setShowVersions(false);
                setShowAts(false);
              }}
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("cv.letterButton")}</span>
            </Button>
          )}

          {/* Adatta a Offerta */}
          {hasContent && (
            <Button
              size="sm"
              variant={showTailor ? "default" : "outline"}
              className={cn(
                "rounded-full gap-1.5",
                !showTailor &&
                  "border-amber-300 text-amber-700 hover:bg-amber-50",
                showTailor && "bg-amber-600 hover:bg-amber-700",
              )}
              onClick={() => {
                setShowTailor((v) => !v);
                setShowVersions(false);
                setShowLetter(false);
                setShowAts(false);
              }}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("cv.tailorButton")}</span>
            </Button>
          )}

          {/* Versioni */}
          {hasContent && (
            <Button
              size="sm"
              variant={showVersions ? "default" : "outline"}
              className="rounded-full gap-1.5"
              onClick={() => {
                setShowVersions((v) => !v);
                setShowTailor(false);
              }}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {t("cv.versionsButton")}
                {versionsCount > 0 ? ` (${versionsCount})` : ""}
              </span>
            </Button>
          )}

          {/* Rigenera */}
          {hasContent && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5"
              onClick={generate}
              disabled={loading}
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5", loading && "animate-spin")}
              />
              <span className="hidden sm:inline">{t("cv.regenerate")}</span>
            </Button>
          )}

          {/* Scarica PDF */}
          {hasContent && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5"
              onClick={downloadPdf}
              disabled={downloading}
              title={t("cv.realPdfTitle")}
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {downloading ? t("cv.downloadingPdf") : t("cv.downloadPdf")}
              </span>
            </Button>
          )}

          {/* Stampa */}
          {hasContent && (
            <Button
              size="sm"
              className="rounded-full gap-1.5"
              onClick={() => window.print()}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t("cv.print")}</span>
            </Button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors ml-0.5"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

    </>
  );
}
