import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, ClipboardCheck, Copy, Download, FileSearch, Lightbulb, Loader2, Mail, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { CoverLetter } from "./cvTypes";

type LetterStatus = "idle" | "generating" | "done" | "error";
type CopyStatus = "idle" | "copied";

type CvCoverLetterPanelProps = {
  letterJobPosting: string;
  setLetterJobPosting: Dispatch<SetStateAction<string>>;
  letterCompany: string;
  setLetterCompany: Dispatch<SetStateAction<string>>;
  letterRole: string;
  setLetterRole: Dispatch<SetStateAction<string>>;
  letterExtra: string;
  setLetterExtra: Dispatch<SetStateAction<string>>;
  letterStatus: LetterStatus;
  setLetterStatus: Dispatch<SetStateAction<LetterStatus>>;
  letterError: string | null;
  letter: CoverLetter | null;
  setLetter: Dispatch<SetStateAction<CoverLetter | null>>;
  copyStatus: CopyStatus;
  generateLetter: () => void | Promise<void>;
  downloadLetterPdf: () => void | Promise<void>;
  downloadingLetter: boolean;
  copyLetter: () => void | Promise<void>;
  onClose: () => void;
};

export function CvCoverLetterPanel({ letterJobPosting, setLetterJobPosting, letterCompany, setLetterCompany, letterRole, setLetterRole, letterExtra, setLetterExtra, letterStatus, setLetterStatus, letterError, letter, setLetter, copyStatus, generateLetter, downloadLetterPdf, downloadingLetter, copyLetter, onClose }: CvCoverLetterPanelProps) {
  const { t } = useTranslation();

  return (
<div className="w-110 shrink-0 flex flex-col border-r bg-background">
  {/* Header */}
  <div className="flex items-center gap-2 px-4 py-3 border-b bg-indigo-50">
    <Mail className="w-4 h-4 text-indigo-600" />
    <h2 className="font-semibold text-sm text-indigo-900">
      {t("cv.letterTitle")}
    </h2>
    <button
      onClick={() => onClose()}
      className="ml-auto p-1 rounded hover:bg-indigo-100"
    >
      <X className="w-3.5 h-3.5 text-indigo-700" />
    </button>
  </div>

  <div className="flex-1 overflow-y-auto p-4 space-y-4">
    {letterStatus !== "done" ? (
      <>
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold mb-1 block">
              {t("cv.letterCompany")}
            </Label>
            <Input
              value={letterCompany}
              onChange={(e) => setLetterCompany(e.target.value)}
              placeholder="es. Google Italia"
              className="h-8 text-xs rounded-lg"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">
              {t("cv.letterRole")}
            </Label>
            <Input
              value={letterRole}
              onChange={(e) => setLetterRole(e.target.value)}
              placeholder="es. UX Designer"
              className="h-8 text-xs rounded-lg"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
            <FileSearch className="w-3.5 h-3.5 text-muted-foreground" />
            {t("cv.jobPostingRequired")}
          </Label>
          <Textarea
            value={letterJobPosting}
            onChange={(e) => {
              setLetterJobPosting(e.target.value);
              if (letterStatus !== "idle")
                setLetterStatus("idle");
            }}
            placeholder={t("cv.letterJobPlaceholder")}
            className="min-h-45 text-xs rounded-xl resize-none font-mono leading-relaxed"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {letterJobPosting.length} {t("cv.chars")}
            {letterJobPosting.length > 0 &&
              letterJobPosting.length < 30 && (
                <span className="text-amber-600 ml-1">
                  {t("cv.charsMin")}
                </span>
              )}
          </p>
        </div>

        <div>
          <Label className="text-xs font-semibold mb-1 block">
            {t("cv.extraNotes")}{" "}
            <span className="font-normal text-muted-foreground">
              {t("cv.optional")}
            </span>
          </Label>
          <Textarea
            value={letterExtra}
            onChange={(e) => setLetterExtra(e.target.value)}
            placeholder={t("cv.extraNotesPlaceholder")}
            className="min-h-15 text-xs rounded-xl resize-none"
          />
        </div>

        {letterStatus === "error" && letterError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              {letterError}
            </p>
          </div>
        )}

        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 space-y-1">
          <p className="text-xs font-semibold text-indigo-800 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" />{" "}
            {t("cv.howItWorks")}
          </p>
          <ul className="text-xs text-indigo-700 space-y-0.5 pl-1">
            {(
              t("cv.letterSteps", {
                returnObjects: true,
              }) as string[]
            ).map((step, i) => (
              <li key={i}>→ {step}</li>
            ))}
          </ul>
        </div>
      </>
    ) : (
      /* Letter preview ? editable paragraphs */
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-700">
            {t("cv.letterGenerated")}
          </p>
        </div>

        {letter?.subject && (
          <div className="rounded-lg bg-muted/50 border px-3 py-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {t("cv.subject")}
            </p>
            <input
              className="w-full text-xs font-semibold bg-transparent outline-none text-foreground"
              value={letter.subject}
              onChange={(e) =>
                setLetter((l) =>
                  l ? { ...l, subject: e.target.value } : l,
                )
              }
            />
          </div>
        )}

        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            {t("cv.salutation")}
          </p>
          <input
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-background outline-none focus:ring-1 focus:ring-indigo-300"
            value={letter?.salutation ?? ""}
            onChange={(e) =>
              setLetter((l) =>
                l ? { ...l, salutation: e.target.value } : l,
              )
            }
          />
        </div>

        {letter?.paragraphs.map((p, i) => (
          <div key={i}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {t("cv.paragraphN", { n: i + 1 })}
            </p>
            <Textarea
              value={p}
              onChange={(e) =>
                setLetter((l) => {
                  if (!l) return l;
                  const np = [...l.paragraphs];
                  np[i] = e.target.value;
                  return { ...l, paragraphs: np };
                })
              }
              className="min-h-20 text-xs rounded-xl resize-none leading-relaxed"
            />
          </div>
        ))}

        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            {t("cv.closing")}
          </p>
          <input
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-background outline-none focus:ring-1 focus:ring-indigo-300"
            value={letter?.closing ?? ""}
            onChange={(e) =>
              setLetter((l) =>
                l ? { ...l, closing: e.target.value } : l,
              )
            }
          />
        </div>

        <div className="rounded-lg bg-muted/30 border px-3 py-2 text-xs font-semibold text-foreground">
          {letter?.senderName}
          {letter?.senderTitle && (
            <span className="font-normal text-muted-foreground ml-2">
              — {letter.senderTitle}
            </span>
          )}
        </div>
      </div>
    )}
  </div>

  {/* Footer actions */}
  <div className="p-4 border-t bg-muted/20 space-y-2">
    {letterStatus !== "done" ? (
      <Button
        className="w-full rounded-xl gap-2 h-10 bg-indigo-600 hover:bg-indigo-700"
        onClick={generateLetter}
        disabled={
          letterStatus === "generating" ||
          letterJobPosting.trim().length < 30
        }
      >
        {letterStatus === "generating" && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        {letterStatus === "generating" ? (
          t("cv.letterWriting")
        ) : (
          <>
            <Mail className="w-4 h-4" />{" "}
            {t("cv.generateLetter")}
          </>
        )}
      </Button>
    ) : (
      <div className="flex gap-2">
        <Button
          className="flex-1 rounded-xl gap-2 h-9 bg-indigo-600 hover:bg-indigo-700"
          onClick={downloadLetterPdf}
          disabled={downloadingLetter}
        >
          {downloadingLetter ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          {downloadingLetter
            ? t("cv.downloadingPdf")
            : t("cv.downloadPdf")}
        </Button>
        <Button
          variant="outline"
          className={cn(
            "flex-1 rounded-xl gap-2 h-9",
            copyStatus === "copied" &&
              "border-emerald-300 text-emerald-700 bg-emerald-50",
          )}
          onClick={copyLetter}
        >
          {copyStatus === "copied" ? (
            <ClipboardCheck className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copyStatus === "copied"
            ? t("cv.copied")
            : t("cv.copyText")}
        </Button>
      </div>
    )}
    {letterStatus === "done" && (
      <Button
        variant="ghost"
        className="w-full rounded-xl h-8 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          setLetterStatus("idle");
        }}
      >
        ↩ {t("cv.generateAnotherLetter")}
      </Button>
    )}
  </div>
</div>
  );
}


type CvCoverLetterMobilePanelProps = CvCoverLetterPanelProps;

export function CvCoverLetterMobilePanel({ letterJobPosting, setLetterJobPosting, letterCompany, setLetterCompany, letterRole, setLetterRole, letterStatus, setLetterStatus, letterError, letter, setLetter, copyStatus, generateLetter, downloadLetterPdf, downloadingLetter, copyLetter, onClose }: CvCoverLetterMobilePanelProps) {
  const { t } = useTranslation();

  return (
<div>
  <div className="flex items-center gap-2 mb-3 pb-3 border-b bg-indigo-50 -mx-4 -mt-4 px-4 pt-4">
    <Mail className="w-4 h-4 text-indigo-600" />
    <h2 className="font-semibold text-sm text-indigo-900">
      {t("cv.letterTitle")}
    </h2>
    <button
      onClick={() => onClose()}
      className="ml-auto p-1 rounded hover:bg-indigo-100"
    >
      <X className="w-3.5 h-3.5 text-indigo-700" />
    </button>
  </div>

  {letterStatus !== "done" ? (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs font-semibold mb-1 block">
            {t("cv.letterCompany")}
          </Label>
          <Input
            value={letterCompany}
            onChange={(e) =>
              setLetterCompany(e.target.value)
            }
            placeholder="es. Google"
            className="h-8 text-xs rounded-lg"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold mb-1 block">
            {t("cv.letterRoleShort")}
          </Label>
          <Input
            value={letterRole}
            onChange={(e) => setLetterRole(e.target.value)}
            placeholder="es. Designer"
            className="h-8 text-xs rounded-lg"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold mb-1.5 block">
          {t("cv.jobPostingShortReq")}
        </Label>
        <Textarea
          value={letterJobPosting}
          onChange={(e) => {
            setLetterJobPosting(e.target.value);
            if (letterStatus !== "idle")
              setLetterStatus("idle");
          }}
          placeholder={t("cv.jobShortPlaceholder")}
          className="min-h-[140px] text-xs rounded-xl resize-none mb-1"
        />
        <p className="text-[11px] text-muted-foreground">
          {letterJobPosting.length} {t("cv.chars")}
        </p>
      </div>
      {letterStatus === "error" && letterError && (
        <div className="flex gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">
            {letterError}
          </p>
        </div>
      )}
      <Button
        className="w-full rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700"
        onClick={generateLetter}
        disabled={
          letterStatus === "generating" ||
          letterJobPosting.trim().length < 30
        }
      >
        {letterStatus === "generating" && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        {letterStatus === "generating" ? (
          t("cv.generatingShort")
        ) : (
          <>
            <Mail className="w-4 h-4" />{" "}
            {t("cv.generateLetter")}
          </>
        )}
      </Button>
    </div>
  ) : (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <p className="text-xs font-semibold text-emerald-700">
          {t("cv.letterReady")}
        </p>
      </div>
      {letter?.paragraphs.map((p, i) => (
        <div key={i}>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            {t("cv.paragraphN", { n: i + 1 })}
          </p>
          <Textarea
            value={p}
            onChange={(e) =>
              setLetter((l) => {
                if (!l) return l;
                const np = [...l.paragraphs];
                np[i] = e.target.value;
                return { ...l, paragraphs: np };
              })
            }
            className="min-h-[70px] text-xs rounded-xl resize-none"
          />
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <Button
          className="flex-1 rounded-xl gap-1.5 bg-indigo-600 hover:bg-indigo-700 h-9"
          onClick={downloadLetterPdf}
          disabled={downloadingLetter}
        >
          {downloadingLetter ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          PDF
        </Button>
        <Button
          variant="outline"
          className={cn(
            "flex-1 rounded-xl gap-1.5 h-9",
            copyStatus === "copied" &&
              "border-emerald-300 text-emerald-700",
          )}
          onClick={copyLetter}
        >
          {copyStatus === "copied" ? (
            <ClipboardCheck className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copyStatus === "copied"
            ? t("cv.copied")
            : t("cv.copyShort")}
        </Button>
      </div>
      <Button
        variant="ghost"
        className="w-full rounded-xl h-8 text-xs text-muted-foreground"
        onClick={() => setLetterStatus("idle")}
      >
        ↩ {t("cv.generateAnotherLetter")}
      </Button>
    </div>
  )}
</div>
  );
}
