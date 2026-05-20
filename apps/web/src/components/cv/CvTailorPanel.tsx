import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Crosshair, FileSearch, Lightbulb, Loader2, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

type TailorStatus = "idle" | "tailoring" | "done" | "error";

type CvTailorPanelProps = {
  jobPosting: string;
  setJobPosting: Dispatch<SetStateAction<string>>;
  tailorStatus: TailorStatus;
  setTailorStatus: Dispatch<SetStateAction<TailorStatus>>;
  tailorError: string | null;
  setTailorError: Dispatch<SetStateAction<string | null>>;
  tailorKeywords: string[];
  tailorCv: () => void | Promise<void>;
  onClose: () => void;
};

export function CvTailorPanel({
  jobPosting,
  setJobPosting,
  tailorStatus,
  setTailorStatus,
  tailorError,
  setTailorError,
  tailorKeywords,
  tailorCv,
  onClose,
}: CvTailorPanelProps) {
  const { t } = useTranslation();

  return (
<div className="w-[400px] flex-shrink-0 flex flex-col border-r bg-background">
  {/* Header */}
  <div className="flex items-center gap-2 px-4 py-3 border-b bg-amber-50">
    <Crosshair className="w-4 h-4 text-amber-600" />
    <h2 className="font-semibold text-sm text-amber-900">
      {t("cv.adaptCvTitle")}
    </h2>
    <button
      onClick={() => onClose()}
      className="ml-auto p-1 rounded hover:bg-amber-100"
    >
      <X className="w-3.5 h-3.5 text-amber-700" />
    </button>
  </div>

  <div className="flex-1 overflow-y-auto p-4 space-y-4">
    {/* How it works */}
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
        <Lightbulb className="w-3.5 h-3.5" />{" "}
        {t("cv.howItWorks")}
      </p>
      <ul className="text-xs text-amber-700 space-y-1 pl-1">
        {(
          t("cv.tailorSteps", {
            returnObjects: true,
          }) as string[]
        ).map((step, i) => (
          <li key={i}>→ {step}</li>
        ))}
      </ul>
    </div>

    {/* Job posting textarea */}
    <div>
      <Label className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
        <FileSearch className="w-3.5 h-3.5 text-muted-foreground" />
        {t("cv.jobPostingLabel")}
      </Label>
      <Textarea
        value={jobPosting}
        onChange={(e) => {
          setJobPosting(e.target.value);
          if (tailorStatus !== "idle") {
            setTailorStatus("idle");
            setTailorError(null);
          }
        }}
        placeholder={t("cv.jobPostingPlaceholder")}
        className="min-h-[220px] text-xs rounded-xl resize-none font-mono leading-relaxed"
      />
      <p className="text-[11px] text-muted-foreground mt-1">
        {jobPosting.length} {t("cv.chars")}
        {jobPosting.length > 0 && jobPosting.length < 30 && (
          <span className="text-amber-600 ml-1">
            {t("cv.charsMin")}
          </span>
        )}
      </p>
    </div>

    {/* Error */}
    {tailorStatus === "error" && tailorError && (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
        <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-xs text-destructive">
          {tailorError}
        </p>
      </div>
    )}

    {/* Success */}
    {tailorStatus === "done" && (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-2">
        <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />{" "}
          {t("cv.adaptedSuccess")}
        </p>
        {tailorKeywords.length > 0 && (
          <div>
            <p className="text-xs text-emerald-700 mb-1.5">
              {t("cv.highlightedKeywords")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tailorKeywords.map((k) => (
                <span
                  key={k}
                  className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-emerald-600">
          {t("cv.adaptedNote")}
        </p>
      </div>
    )}
  </div>

  {/* Action button */}
  <div className="p-4 border-t bg-muted/20">
    <Button
      className={cn(
        "w-full rounded-xl gap-2 h-10",
        tailorStatus === "done"
          ? "bg-emerald-600 hover:bg-emerald-700"
          : "bg-amber-600 hover:bg-amber-700",
      )}
      onClick={
        tailorStatus === "done"
          ? () => {
              setTailorStatus("idle");
              setJobPosting("");
            }
          : tailorCv
      }
      disabled={
        tailorStatus === "tailoring" ||
        jobPosting.trim().length < 30
      }
    >
      {tailorStatus === "tailoring" && (
        <Loader2 className="w-4 h-4 animate-spin" />
      )}
      {tailorStatus === "tailoring" ? (
        t("cv.adapting")
      ) : tailorStatus === "done" ? (
        t("cv.adaptAnother")
      ) : (
        <>
          <Crosshair className="w-4 h-4" /> {t("cv.adapt")}
        </>
      )}
    </Button>
    {tailorStatus === "idle" &&
      jobPosting.trim().length >= 30 && (
        <p className="text-center text-[11px] text-muted-foreground mt-2">
          {t("cv.aiRewriteNote")}
        </p>
      )}
  </div>
</div>
  );
}


type CvTailorMobilePanelProps = CvTailorPanelProps;

export function CvTailorMobilePanel({ jobPosting, setJobPosting, tailorStatus, setTailorStatus, tailorError, tailorKeywords, tailorCv, onClose }: CvTailorMobilePanelProps) {
  const { t } = useTranslation();

  return (
<div>
  <div className="flex items-center gap-2 mb-3 pb-3 border-b bg-amber-50 -mx-4 -mt-4 px-4 pt-4">
    <Crosshair className="w-4 h-4 text-amber-600" />
    <h2 className="font-semibold text-sm text-amber-900">
      {t("cv.adaptCvTitle")}
    </h2>
    <button
      onClick={() => onClose()}
      className="ml-auto p-1 rounded hover:bg-amber-100"
    >
      <X className="w-3.5 h-3.5 text-amber-700" />
    </button>
  </div>
  <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4 space-y-1">
    <p className="text-xs font-semibold text-amber-800">
      {t("cv.howItWorks")}
    </p>
    <p className="text-xs text-amber-700">
      {t("cv.tailorMobileDesc")}
    </p>
  </div>
  <Label className="text-xs font-semibold mb-1.5 block">
    {t("cv.jobPostingShort")}
  </Label>
  <Textarea
    value={jobPosting}
    onChange={(e) => {
      setJobPosting(e.target.value);
      if (tailorStatus !== "idle") setTailorStatus("idle");
    }}
    placeholder={t("cv.jobShortPlaceholder")}
    className="min-h-[160px] text-xs rounded-xl resize-none mb-3"
  />
  {tailorStatus === "error" && tailorError && (
    <div className="flex gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-3">
      <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
      <p className="text-xs text-destructive">
        {tailorError}
      </p>
    </div>
  )}
  {tailorStatus === "done" && (
    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-3">
      <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />{" "}
        {t("cv.cvAdaptedMobile")}
      </p>
      {tailorKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tailorKeywords.map((k) => (
            <span
              key={k}
              className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full"
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  )}
  <Button
    className={cn(
      "w-full rounded-xl gap-2",
      tailorStatus === "done"
        ? "bg-emerald-600 hover:bg-emerald-700"
        : "bg-amber-600 hover:bg-amber-700",
    )}
    onClick={
      tailorStatus === "done"
        ? () => {
            setTailorStatus("idle");
            setJobPosting("");
          }
        : tailorCv
    }
    disabled={
      tailorStatus === "tailoring" ||
      jobPosting.trim().length < 30
    }
  >
    {tailorStatus === "tailoring" && (
      <Loader2 className="w-4 h-4 animate-spin" />
    )}
    {tailorStatus === "tailoring" ? (
      t("cv.adapting")
    ) : tailorStatus === "done" ? (
      `↩ ${t("cv.adaptAnother")}`
    ) : (
      <>
        <Crosshair className="w-4 h-4" /> {t("cv.adapt")}
      </>
    )}
  </Button>
</div>
  );
}
