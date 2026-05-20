import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AlertCircle, BarChart2, FileSearch, Lightbulb, Loader2, TrendingUp, X, Zap } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { AtsResult } from "./cvTypes";

type AtsStatus = "idle" | "analyzing" | "done" | "error";

type CvAtsPanelProps = {
  atsJobPosting: string;
  setAtsJobPosting: Dispatch<SetStateAction<string>>;
  atsStatus: AtsStatus;
  setAtsStatus: Dispatch<SetStateAction<AtsStatus>>;
  atsError: string | null;
  atsResult: AtsResult | null;
  setAtsResult: Dispatch<SetStateAction<AtsResult | null>>;
  analyzeAts: () => void | Promise<void>;
  onClose: () => void;
};

export function CvAtsPanel({ atsJobPosting, setAtsJobPosting, atsStatus, setAtsStatus, atsError, atsResult, setAtsResult, analyzeAts, onClose }: CvAtsPanelProps) {
  const { t } = useTranslation();
  const scoreColor = (s: number) =>
    s >= 80 ? "hsl(var(--chart-2))" : s >= 60 ? "hsl(var(--primary))" : "hsl(var(--chart-5))";
  const scoreBg = (s: number) =>
    s >= 80
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : s >= 60
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-red-50 border-red-200 text-red-800";
  const R = 45;
  const CX = 60;
  const CY = 60;
  const CIRC = 2 * Math.PI * R;

  return (
<div className="w-100 shrink-0 flex flex-col border-r bg-background">
  {/* Header */}
  <div className="flex items-center gap-2 px-4 py-3 border-b bg-teal-50">
    <BarChart2 className="w-4 h-4 text-teal-600" />
    <h2 className="font-semibold text-sm text-teal-900">
      {t("cv.atsTitle")}
    </h2>
    <button
      onClick={() => onClose()}
      className="ml-auto p-1 rounded hover:bg-teal-100"
    >
      <X className="w-3.5 h-3.5 text-teal-700" />
    </button>
  </div>

  <div className="flex-1 overflow-y-auto p-4 space-y-4">
    {atsStatus !== "done" ? (
      <>
        <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-teal-800 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" />{" "}
            {t("cv.howItWorks")}
          </p>
          <ul className="text-xs text-teal-700 space-y-0.5 pl-1">
            {(
              t("cv.atsSteps", {
                returnObjects: true,
              }) as string[]
            ).map((step, i) => (
              <li key={i}>→ {step}</li>
            ))}
          </ul>
        </div>

        <div>
          <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
            <FileSearch className="w-3.5 h-3.5 text-muted-foreground" />
            {t("cv.jobPostingLabel")}
          </Label>
          <Textarea
            value={atsJobPosting}
            onChange={(e) => {
              setAtsJobPosting(e.target.value);
              if (atsStatus !== "idle")
                setAtsStatus("idle");
            }}
            placeholder={t("cv.atsJobPlaceholder")}
            className="min-h-55 text-xs rounded-xl resize-none font-mono leading-relaxed"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {atsJobPosting.length} {t("cv.chars")}
            {atsJobPosting.length > 0 &&
              atsJobPosting.length < 30 && (
                <span className="text-amber-600 ml-1">
                  {t("cv.charsMin")}
                </span>
              )}
          </p>
        </div>

        {atsStatus === "error" && atsError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              {atsError}
            </p>
          </div>
        )}
      </>
    ) : atsResult ? (
      <>
        {/* Score gauge */}
        <div className="flex flex-col items-center py-2">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
          >
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="10"
            />
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={scoreColor(atsResult.score)}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(CIRC * atsResult.score) / 100} ${CIRC}`}
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{
                transition: "stroke-dasharray 0.8s ease",
              }}
            />
            <text
              x={CX}
              y={CY + 8}
              textAnchor="middle"
              fontSize="22"
              fontWeight="bold"
              fill={scoreColor(atsResult.score)}
            >
              {atsResult.score}
            </text>
            <text
              x={CX}
              y={CY + 22}
              textAnchor="middle"
              fontSize="9"
              fill="hsl(var(--muted-foreground))"
            >
              /100
            </text>
          </svg>
          <span
            className={cn(
              "text-sm font-bold px-3 py-1 rounded-full border mt-1",
              scoreBg(atsResult.score),
            )}
          >
            {atsResult.label}
          </span>
        </div>

        {/* Sections */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-foreground">
            {t("cv.sectionBreakdown")}
          </p>
          {atsResult.sections.map((sec) => (
            <div key={sec.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">
                  {sec.name}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: scoreColor(sec.score) }}
                >
                  {sec.score}%
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${sec.score}%`,
                    backgroundColor: scoreColor(sec.score),
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {sec.feedback}
              </p>
            </div>
          ))}
        </div>

        {/* Strengths */}
        {atsResult.strengths.length > 0 && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />{" "}
              {t("cv.strengths")}
            </p>
            {atsResult.strengths.map((s, i) => (
              <p
                key={i}
                className="text-xs text-emerald-700 flex gap-1.5"
              >
                <span className="shrink-0">✓</span>
                {s}
              </p>
            ))}
          </div>
        )}

        {/* Missing keywords */}
        {atsResult.missingKeywords.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />{" "}
              {t("cv.missingKeywords")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {atsResult.missingKeywords.map((k) => (
                <span
                  key={k}
                  className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="rounded-xl bg-muted/40 border p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">
            {t("cv.howToImprove")}
          </p>
          {atsResult.tips.map((t, i) => (
            <p
              key={i}
              className="text-xs text-foreground flex gap-2"
            >
              <span className="shrink-0 w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold">
                {i + 1}
              </span>
              {t}
            </p>
          ))}
        </div>
      </>
    ) : null}
  </div>

  {/* Footer action */}
  <div className="p-4 border-t bg-muted/20">
    {atsStatus !== "done" ? (
      <Button
        className="w-full rounded-xl gap-2 h-10 bg-teal-600 hover:bg-teal-700"
        onClick={analyzeAts}
        disabled={
          atsStatus === "analyzing" ||
          atsJobPosting.trim().length < 30
        }
      >
        {atsStatus === "analyzing" && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        {atsStatus === "analyzing" ? (
          t("cv.analyzing")
        ) : (
          <>
            <BarChart2 className="w-4 h-4" />{" "}
            {t("cv.analyzeCompat")}
          </>
        )}
      </Button>
    ) : (
      <div className="space-y-2">
        <p className="text-center text-xs text-muted-foreground">
          {t("cv.atsTipUseTailor")}
        </p>
        <Button
          variant="ghost"
          className="w-full rounded-xl h-8 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            setAtsStatus("idle");
            setAtsResult(null);
          }}
        >
          ↩ {t("cv.analyzeAnother")}
        </Button>
      </div>
    )}
  </div>
</div>
  );
}


type CvAtsMobilePanelProps = CvAtsPanelProps;

export function CvAtsMobilePanel({
  atsJobPosting,
  setAtsJobPosting,
  atsStatus,
  setAtsStatus,
  atsError,
  atsResult,
  setAtsResult,
  analyzeAts,
  onClose,
}: CvAtsMobilePanelProps) {
  const { t } = useTranslation();

  return (
<div>
  <div className="flex items-center gap-2 mb-3 pb-3 border-b bg-teal-50 -mx-4 -mt-4 px-4 pt-4">
    <BarChart2 className="w-4 h-4 text-teal-600" />
    <h2 className="font-semibold text-sm text-teal-900">
      {t("cv.atsTitle")}
    </h2>
    <button
      onClick={() => onClose()}
      className="ml-auto p-1 rounded hover:bg-teal-100"
    >
      <X className="w-3.5 h-3.5 text-teal-700" />
    </button>
  </div>
  {atsStatus !== "done" ? (
    <div className="mt-4 space-y-3">
      <Label className="text-xs font-semibold mb-1.5 block">
        {t("cv.jobPostingShort")}
      </Label>
      <Textarea
        value={atsJobPosting}
        onChange={(e) => {
          setAtsJobPosting(e.target.value);
          if (atsStatus !== "idle") setAtsStatus("idle");
        }}
        placeholder={t("cv.atsJobShortPlaceholder")}
        className="min-h-[150px] text-xs rounded-xl resize-none"
      />
      {atsStatus === "error" && atsError && (
        <div className="flex gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">
            {atsError}
          </p>
        </div>
      )}
      <Button
        className="w-full rounded-xl gap-2 bg-teal-600 hover:bg-teal-700"
        onClick={analyzeAts}
        disabled={
          atsStatus === "analyzing" ||
          atsJobPosting.trim().length < 30
        }
      >
        {atsStatus === "analyzing" && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        {atsStatus === "analyzing" ? (
          t("cv.analyzing")
        ) : (
          <>
            <BarChart2 className="w-4 h-4" />{" "}
            {t("cv.analyze")}
          </>
        )}
      </Button>
    </div>
  ) : atsResult ? (
    <div className="mt-4 space-y-4">
      {/* Score */}
      <div className="flex items-center gap-4 p-3 rounded-xl border bg-muted/30">
        {(() => {
          const R = 32;
          const CX = 36;
          const CY = 36;
          const CIRC = 2 * Math.PI * R;
          const color =
            atsResult.score >= 80
              ? "hsl(var(--chart-2))"
              : atsResult.score >= 60
                ? "hsl(var(--primary))"
                : "hsl(var(--chart-5))";
          return (
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="8"
              />
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(CIRC * atsResult.score) / 100} ${CIRC}`}
                transform={`rotate(-90 ${CX} ${CY})`}
              />
              <text
                x={CX}
                y={CY + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="bold"
                fill={color}
              >
                {atsResult.score}
              </text>
            </svg>
          );
        })()}
        <div>
          <p className="text-lg font-bold text-foreground">
            {atsResult.score}/100
          </p>
          <p
            className="text-sm font-semibold"
            style={{
              color:
                atsResult.score >= 80
                  ? "hsl(var(--chart-2))"
                  : atsResult.score >= 60
                    ? "hsl(var(--primary))"
                    : "hsl(var(--chart-5))",
            }}
          >
            {atsResult.label}
          </p>
        </div>
      </div>
      {/* Sections */}
      <div className="space-y-2">
        {atsResult.sections.map((sec) => {
          const color =
            sec.score >= 80
              ? "hsl(var(--chart-2))"
              : sec.score >= 60
                ? "hsl(var(--primary))"
                : "hsl(var(--chart-5))";
          return (
            <div key={sec.name}>
              <div className="flex justify-between mb-0.5">
                <span className="text-xs font-medium">
                  {sec.name}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color }}
                >
                  {sec.score}%
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${sec.score}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {/* Missing keywords */}
      {atsResult.missingKeywords.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />{" "}
            {t("cv.missingKeywords")}
          </p>
          <div className="flex flex-wrap gap-1">
            {atsResult.missingKeywords.map((k) => (
              <span
                key={k}
                className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-full"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Tips */}
      <div className="rounded-xl bg-muted/40 border p-3 space-y-1.5">
        <p className="text-xs font-semibold">
          {t("cv.howToImprove")}
        </p>
        {atsResult.tips.map((t, i) => (
          <p key={i} className="text-xs flex gap-2">
            <span className="shrink-0 w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold">
              {i + 1}
            </span>
            {t}
          </p>
        ))}
      </div>
      <Button
        variant="ghost"
        className="w-full rounded-xl h-8 text-xs text-muted-foreground"
        onClick={() => {
          setAtsStatus("idle");
          setAtsResult(null);
        }}
      >
        ↩ {t("cv.analyzeAnother")}
      </Button>
    </div>
  ) : null}
</div>
  );
}
