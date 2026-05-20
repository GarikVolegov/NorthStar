import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AlertCircle, Check, CheckCircle2, Clock, FolderOpen, History, Loader2, PenLine, Save, Trash2, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { GeneratedCv } from "./cvTypes";
import { formatSavedAt } from "./cvUtils";

type VersionSaveStatus = "idle" | "saving" | "saved" | "error";
export type CvVersionSummary = { id: string; name: string; targetRole: string; savedAt: string };

type CvVersionsPanelProps = {
  generated: GeneratedCv | null;
  versions: CvVersionSummary[];
  newVersionName: string;
  setNewVersionName: Dispatch<SetStateAction<string>>;
  versionSaveStatus: VersionSaveStatus;
  saveAsVersion: () => void | Promise<void>;
  renamingId: string | null;
  setRenamingId: Dispatch<SetStateAction<string | null>>;
  renameValue: string;
  setRenameValue: Dispatch<SetStateAction<string>>;
  renameVersion: (id: string) => void | Promise<void>;
  deleteVersion: (id: string) => void | Promise<void>;
  loadVersion: (id: string) => void | Promise<void>;
  loadingVersionId: string | null;
  onClose: () => void;
};

export function CvVersionsPanel({ generated, versions, newVersionName, setNewVersionName, versionSaveStatus, saveAsVersion, renamingId, setRenamingId, renameValue, setRenameValue, renameVersion, deleteVersion, loadVersion, loadingVersionId, onClose }: CvVersionsPanelProps) {
  const { t } = useTranslation();

  return (
<div className="w-90 shrink-0 flex flex-col border-r bg-background">
  <div className="flex items-center gap-2 px-4 py-3 border-b">
    <History className="w-4 h-4 text-primary" />
    <h2 className="font-semibold text-sm text-foreground">
      {t("cv.savedVersions")}
    </h2>
    <span className="ml-auto text-xs text-muted-foreground">
      {versions.length}/20
    </span>
    <button
      onClick={() => onClose()}
      className="p-1 rounded hover:bg-muted ml-1"
    >
      <X className="w-3.5 h-3.5 text-muted-foreground" />
    </button>
  </div>

  {/* Save current as new version */}
  <div className="px-4 py-3 border-b bg-muted/30">
    <p className="text-xs font-medium text-foreground mb-2">
      {t("cv.saveCurrentVersion")}
    </p>
    <div className="flex gap-2">
      <Input
        value={newVersionName}
        onChange={(e) => setNewVersionName(e.target.value)}
        placeholder={`CV ${new Date().toLocaleDateString()}`}
        className="h-8 text-xs rounded-lg flex-1"
        onKeyDown={(e) => {
          if (e.key === "Enter") saveAsVersion();
        }}
      />
      <Button
        size="sm"
        className={cn(
          "h-8 rounded-lg gap-1.5 shrink-0",
          versionSaveStatus === "saved" && "bg-emerald-600",
        )}
        onClick={saveAsVersion}
        disabled={versionSaveStatus === "saving" || !generated}
      >
        {versionSaveStatus === "saving" && (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        )}
        {versionSaveStatus === "saved" && (
          <CheckCircle2 className="w-3.5 h-3.5" />
        )}
        {versionSaveStatus === "idle" && (
          <Save className="w-3.5 h-3.5" />
        )}
        {versionSaveStatus === "error" && (
          <AlertCircle className="w-3.5 h-3.5" />
        )}
        {versionSaveStatus === "saved"
          ? t("cv.versionSaved")
          : t("cv.save")}
      </Button>
    </div>
  </div>

  {/* Version list */}
  <div className="flex-1 overflow-y-auto">
    {versions.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <FolderOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Nessuna versione salvata
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Usa il form qui sopra per salvare una versione del CV
          corrente
        </p>
      </div>
    ) : (
      <div className="divide-y">
        {versions.map((v) => (
          <div
            key={v.id}
            className="px-4 py-3 hover:bg-muted/30 transition-colors group"
          >
            {renamingId === v.id ? (
              <div className="flex gap-2 items-center mb-1">
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) =>
                    setRenameValue(e.target.value)
                  }
                  className="h-7 text-xs rounded-md flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameVersion(v.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                />
                <button
                  onClick={() => renameVersion(v.id)}
                  className="p-1 rounded hover:bg-primary/10 text-primary"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRenamingId(null)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 mb-1">
                <p className="text-sm font-medium text-foreground leading-tight flex-1 truncate">
                  {v.name}
                </p>
                <button
                  onClick={() => {
                    setRenamingId(v.id);
                    setRenameValue(v.name);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0 mt-0.5"
                  title={t("cv.rename")}
                >
                  <PenLine className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            )}
            {v.targetRole && (
              <p className="text-xs text-muted-foreground mb-2">
                🎯 {v.targetRole}
              </p>
            )}
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatSavedAt(v.savedAt)}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px] rounded-md gap-1"
                  onClick={() => loadVersion(v.id)}
                  disabled={loadingVersionId === v.id}
                >
                  {loadingVersionId === v.id ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <FolderOpen className="w-2.5 h-2.5" />
                  )}
                  {t("cv.loadVersion")}
                </Button>
                <button
                  onClick={() => deleteVersion(v.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title={t("cv.deleteVersion")}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
  );
}


type CvVersionsMobilePanelProps = CvVersionsPanelProps;

export function CvVersionsMobilePanel({
  versions,
  newVersionName,
  setNewVersionName,
  versionSaveStatus,
  saveAsVersion,
  deleteVersion,
  loadVersion,
  loadingVersionId,
  onClose,
}: CvVersionsMobilePanelProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 pb-3 border-b">
        <History className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">{t("cv.savedVersions")}</h2>
        <button
          onClick={onClose}
          className="ml-auto p-1 rounded hover:bg-muted"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="flex gap-2 mb-3">
        <Input
          value={newVersionName}
          onChange={(e) => setNewVersionName(e.target.value)}
          placeholder={`CV ${new Date().toLocaleDateString()}`}
          className="h-8 text-xs rounded-lg flex-1"
        />
        <Button
          size="sm"
          className="h-8 rounded-lg gap-1 shrink-0"
          onClick={saveAsVersion}
          disabled={versionSaveStatus === "saving"}
        >
          {versionSaveStatus === "saving" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {versionSaveStatus === "saved" ? t("cv.versionSaved") : t("cv.save")}
        </Button>
      </div>
      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("cv.noVersions")}
        </p>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className="border rounded-lg p-3">
              <p className="text-sm font-medium mb-0.5 truncate">{v.name}</p>
              {v.targetRole && (
                <p className="text-xs text-muted-foreground mb-2">
                  🎯 {v.targetRole}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs rounded-md gap-1"
                  onClick={() => loadVersion(v.id)}
                  disabled={loadingVersionId === v.id}
                >
                  {loadingVersionId === v.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FolderOpen className="w-3 h-3" />
                  )}
                  {t("cv.loadVersion")}
                </Button>
                <button
                  onClick={() => deleteVersion(v.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
