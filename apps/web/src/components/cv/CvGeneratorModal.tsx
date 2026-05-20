import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CvAtsMobilePanel, CvAtsPanel } from "./CvAtsPanel";
import {
  CvCoverLetterMobilePanel,
  CvCoverLetterPanel,
} from "./CvCoverLetterPanel";
import { CvDocument } from "./CvEditorComponents";
import { CvDesktopEditShell, CvMobileEditShell } from "./CvEditShell";
import { CvErrorState, CvLoadingState, CvModalFooter } from "./CvModalState";
import type { CvData } from "./CvSection";
import { CvTailorMobilePanel, CvTailorPanel } from "./CvTailorPanel";
import { CvToolbar } from "./CvToolbar";
import type { AtsResult, CoverLetter, GeneratedCv, GraphNode } from "./cvTypes";
import { errorMessage, savedCvData } from "./cvUtils";
import { CvVersionsMobilePanel, CvVersionsPanel } from "./CvVersionsPanel";
import { useCvPrintStyle } from "./useCvPrintStyle";

const BASE = import.meta.env.BASE_URL || "/";

type CvProfileSector = {
  confirmed?: boolean;
  name?: string;
  skills?: string[];
};

function useProfileForCv(userId: number) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () =>
      apiFetch(`${BASE}api/profile/${userId}`).then((r) => r.json()),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function CvGeneratorModal({
  userId,
  cvData,
  confirmedSectorId,
  onClose,
}: {
  userId: number;
  cvData: CvData | null;
  confirmedSectorId?: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useProfileForCv(userId);
  const savedData = savedCvData(cvData);
  const [generated, setGenerated] = useState<GeneratedCv | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("preview");
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    savedData.lastSaved ?? null,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // -- Version history state ------------------------------------------
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<
    Array<{
      id: string;
      name: string;
      targetRole: string;
      savedAt: string;
    }>
  >([]);
  const [versionSaveStatus, setVersionSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [newVersionName, setNewVersionName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // -- Tailor state ---------------------------------------------------
  const [showTailor, setShowTailor] = useState(false);
  const [jobPosting, setJobPosting] = useState("");
  const [tailorStatus, setTailorStatus] = useState<
    "idle" | "tailoring" | "done" | "error"
  >("idle");
  const [tailorError, setTailorError] = useState<string | null>(null);
  const [tailorKeywords, setTailorKeywords] = useState<string[]>([]);

  // -- Cover letter state ---------------------------------------------
  const [showLetter, setShowLetter] = useState(false);
  const [letterJobPosting, setLetterJobPosting] = useState("");
  const [letterCompany, setLetterCompany] = useState("");
  const [letterRole, setLetterRole] = useState("");
  const [letterExtra, setLetterExtra] = useState("");
  const [letterStatus, setLetterStatus] = useState<
    "idle" | "generating" | "done" | "error"
  >("idle");
  const [letterError, setLetterError] = useState<string | null>(null);
  const [letter, setLetter] = useState<CoverLetter | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [downloadingLetter, setDownloadingLetter] = useState(false);

  // -- ATS Score state ------------------------------------------------
  const [showAts, setShowAts] = useState(false);
  const [atsJobPosting, setAtsJobPosting] = useState("");
  const [atsStatus, setAtsStatus] = useState<
    "idle" | "analyzing" | "done" | "error"
  >("idle");
  const [atsError, setAtsError] = useState<string | null>(null);
  const [atsResult, setAtsResult] = useState<AtsResult | null>(null);

  async function fetchVersions() {
    try {
      const res = await apiFetch(`${BASE}api/cv/${userId}/versions`);
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch {
      /* silent */
    }
  }

  async function saveAsVersion() {
    if (!generated) return;
    setVersionSaveStatus("saving");
    try {
      const res = await apiFetch(`${BASE}api/cv/${userId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated, name: newVersionName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVersions((prev) => [data.version, ...prev]);
      setNewVersionName("");
      setVersionSaveStatus("saved");
      setTimeout(() => setVersionSaveStatus("idle"), 2500);
    } catch {
      setVersionSaveStatus("error");
      setTimeout(() => setVersionSaveStatus("idle"), 2500);
    }
  }

  async function renameVersion(id: string) {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await apiFetch(`${BASE}api/cv/${userId}/versions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      setVersions((prev) =>
        prev.map((v) => (v.id === id ? { ...v, name: renameValue.trim() } : v)),
      );
    } catch {
      /* silent */
    } finally {
      setRenamingId(null);
    }
  }

  async function deleteVersion(id: string) {
    try {
      await apiFetch(`${BASE}api/cv/${userId}/versions/${id}`, {
        method: "DELETE",
      });
      setVersions((prev) => prev.filter((v) => v.id !== id));
    } catch {
      /* silent */
    }
  }

  async function tailorCv() {
    if (!generated || !jobPosting.trim()) return;
    setTailorStatus("tailoring");
    setTailorError(null);
    setTailorKeywords([]);
    try {
      const res = await apiFetch(`${BASE}api/cv/${userId}/tailor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated, jobPosting }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nell'adattamento");
      setGenerated(data.tailored);
      setHasUnsavedChanges(true);
      setSaveStatus("idle");
      setTailorStatus("done");
      // Auto-detect matched keywords for the success message
      const posting = jobPosting.toLowerCase();
      const matched = [
        ...(data.tailored.skills ?? []),
        ...(data.tailored.tools ?? []),
      ]
        .filter((k: string) => posting.includes(k.toLowerCase()))
        .slice(0, 6);
      setTailorKeywords(matched);
    } catch (err: unknown) {
      setTailorError(errorMessage(err, "Errore di rete. Riprova."));
      setTailorStatus("error");
    }
  }

  async function downloadPdf() {
    if (!generated) return;
    setDownloading(true);
    try {
      // First save the current state so the server has the latest version
      await apiFetch(`${BASE}api/cv/${userId}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated }),
      });
      // Then trigger download
      const a = document.createElement("a");
      a.href = `${BASE}api/cv/${userId}/pdf`;
      a.download = `CV_NorthStar.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      /* silent */
    } finally {
      setDownloading(false);
    }
  }

  async function loadVersion(id: string) {
    setLoadingVersionId(id);
    try {
      const res = await apiFetch(`${BASE}api/cv/${userId}/versions/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGenerated(data.version.data);
      setHasUnsavedChanges(false);
      setSaveStatus("idle");
      setShowVersions(false);
    } catch {
      /* silent */
    } finally {
      setLoadingVersionId(null);
    }
  }

  function readGraphNodes(): GraphNode[] {
    try {
      const key = `grafo_user_${confirmedSectorId}_${userId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw).nodes ?? [];
    } catch {
      return [];
    }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setHasUnsavedChanges(false);
    try {
      const latestSession = profile?.testSessions?.[0];
      const confirmedSector = (
        profile?.exploredSectors as CvProfileSector[] | undefined
      )?.find((sector) => sector.confirmed);
      const graphNodes = readGraphNodes();
      const res = await apiFetch(`${BASE}api/cv/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          profileData: {
            name: user?.name ?? profile?.name ?? "",
            email: user?.email ?? profile?.email ?? "",
            riasecTypes: latestSession?.primaryTypes ?? [],
            confirmedSector: confirmedSector?.name ?? "",
            skills: confirmedSector?.skills ?? [],
          },
          graphNodes,
          cvData: cvData ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nella generazione");
      setGenerated(data.generated);
      setIsEditing(false);
      setSaveStatus("idle");
    } catch (err: unknown) {
      setError(errorMessage(err, "Errore di rete. Riprova."));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!generated) return;
    setSaveStatus("saving");
    try {
      const res = await apiFetch(`${BASE}api/cv/${userId}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nel salvataggio");
      setLastSavedAt(data.savedAt);
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
      // Refresh the CvSection so it shows the new saved state
      queryClient.invalidateQueries({ queryKey: ["cv", userId] });
      // Reset "saved" badge after 3 seconds
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // Handle CV changes and mark as unsaved
  function handleCvChange(updated: GeneratedCv) {
    setGenerated(updated);
    setHasUnsavedChanges(true);
    setSaveStatus("idle");
  }

  async function analyzeAts() {
    if (!generated || atsJobPosting.trim().length < 30) return;
    setAtsStatus("analyzing");
    setAtsError(null);
    try {
      const res = await apiFetch(`${BASE}api/cv/${userId}/ats-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated, jobPosting: atsJobPosting }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nell'analisi");
      setAtsResult(data.result);
      setAtsStatus("done");
    } catch (err: unknown) {
      setAtsError(errorMessage(err, "Errore di rete. Riprova."));
      setAtsStatus("error");
    }
  }

  async function generateLetter() {
    if (!generated || letterJobPosting.trim().length < 30) return;
    setLetterStatus("generating");
    setLetterError(null);
    try {
      const res = await apiFetch(`${BASE}api/cv/${userId}/cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generated,
          jobPosting: letterJobPosting,
          companyName: letterCompany.trim() || undefined,
          roleTitle: letterRole.trim() || undefined,
          extraInfo: letterExtra.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nella generazione");
      setLetter(data.letter);
      setLetterStatus("done");
    } catch (err: unknown) {
      setLetterError(errorMessage(err, "Errore di rete. Riprova."));
      setLetterStatus("error");
    }
  }

  async function downloadLetterPdf() {
    if (!letter) return;
    setDownloadingLetter(true);
    try {
      const encoded = encodeURIComponent(
        btoa(unescape(encodeURIComponent(JSON.stringify(letter)))),
      );
      const res = await apiFetch(
        `${BASE}api/cv/${userId}/cover-letter/pdf?data=${encoded}`,
      );
      if (!res.ok) throw new Error("Errore PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lettera-${(letter.senderName ?? "cv").replace(/\s+/g, "-").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* silent */
    } finally {
      setDownloadingLetter(false);
    }
  }

  async function copyLetter() {
    if (!letter) return;
    const text = [
      letter.salutation,
      "",
      ...letter.paragraphs,
      "",
      letter.closing,
      letter.senderName,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 2500);
  }

  // On open: if a saved generated CV exists, load it directly ? skip AI generation
  useEffect(() => {
    const savedGenerated = savedData.generated;
    if (savedGenerated && typeof savedGenerated === "object") {
      setGenerated(savedGenerated);
    } else {
      generate();
    }
    // Load saved cover letter if any
    const savedLetter = savedData.coverLetter;
    if (savedLetter) setLetter(savedLetter);
  }, []);

  // Load version list whenever the panel opens
  useEffect(() => {
    if (showVersions) fetchVersions();
  }, [showVersions]);

  useCvPrintStyle();

  const hasContent = !!generated && !loading;
  const tailorPanelProps = {
    jobPosting,
    setJobPosting,
    tailorStatus,
    setTailorStatus,
    tailorError,
    setTailorError,
    tailorKeywords,
    tailorCv,
    onClose: () => setShowTailor(false),
  };
  const versionsPanelProps = {
    generated,
    versions,
    newVersionName,
    setNewVersionName,
    versionSaveStatus,
    saveAsVersion,
    renamingId,
    setRenamingId,
    renameValue,
    setRenameValue,
    renameVersion,
    deleteVersion,
    loadVersion,
    loadingVersionId,
    onClose: () => setShowVersions(false),
  };
  const letterPanelProps = {
    letterJobPosting,
    setLetterJobPosting,
    letterCompany,
    setLetterCompany,
    letterRole,
    setLetterRole,
    letterExtra,
    setLetterExtra,
    letterStatus,
    setLetterStatus,
    letterError,
    letter,
    setLetter,
    copyStatus,
    generateLetter,
    downloadLetterPdf,
    downloadingLetter,
    copyLetter,
    onClose: () => setShowLetter(false),
  };
  const atsPanelProps = {
    atsJobPosting,
    setAtsJobPosting,
    atsStatus,
    setAtsStatus,
    atsError,
    atsResult,
    setAtsResult,
    analyzeAts,
    onClose: () => setShowAts(false),
  };

  return (
    <div
      id="cv-print-portal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <CvToolbar
        generated={generated}
        hasContent={hasContent}
        lastSavedAt={lastSavedAt}
        hasUnsavedChanges={hasUnsavedChanges}
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        saveStatus={saveStatus}
        save={save}
        showAts={showAts}
        setShowAts={setShowAts}
        showLetter={showLetter}
        setShowLetter={setShowLetter}
        showTailor={showTailor}
        setShowTailor={setShowTailor}
        showVersions={showVersions}
        setShowVersions={setShowVersions}
        versionsCount={versions.length}
        generate={generate}
        loading={loading}
        downloadPdf={downloadPdf}
        downloading={downloading}
        onClose={onClose}
      />

      {/* -- Body -- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Loading */}
        {loading && <CvLoadingState cvData={cvData} />}

        {/* Error */}
        {error && !loading && <CvErrorState error={error} retry={generate} />}

        {/* Content */}
        {generated && !loading && (
          <>
            {/* Desktop: side-by-side */}
            <div className="hidden md:flex flex-1 overflow-hidden">
              {isEditing &&
                !showVersions &&
                !showTailor &&
                !showLetter &&
                !showAts && (
                  <CvDesktopEditShell
                    cv={generated}
                    onChange={handleCvChange}
                    save={save}
                    saveStatus={saveStatus}
                    hasUnsavedChanges={hasUnsavedChanges}
                    lastSavedAt={lastSavedAt}
                  />
                )}

              {showTailor && <CvTailorPanel {...tailorPanelProps} />}

              {showVersions && <CvVersionsPanel {...versionsPanelProps} />}

              {showLetter && <CvCoverLetterPanel {...letterPanelProps} />}

              {showAts && <CvAtsPanel {...atsPanelProps} />}

              {/* Preview */}
              <div
                id="cv-preview-scroll"
                className="flex-1 overflow-auto py-8 px-6 bg-muted/30"
              >
                <CvDocument cv={generated} />
              </div>
            </div>

            {/* Mobile: tabbed */}
            <div className="flex md:hidden flex-1 overflow-hidden">
              {mobileTab === "edit" ? (
                <div className="flex-1 overflow-y-auto p-4 bg-background">
                  {showAts ? (
                    <CvAtsMobilePanel {...atsPanelProps} />
                  ) : showLetter ? (
                    <CvCoverLetterMobilePanel {...letterPanelProps} />
                  ) : showTailor ? (
                    <CvTailorMobilePanel {...tailorPanelProps} />
                  ) : showVersions ? (
                    <CvVersionsMobilePanel {...versionsPanelProps} />
                  ) : (
                    <CvMobileEditShell
                      cv={generated}
                      onChange={handleCvChange}
                      save={save}
                      saveStatus={saveStatus}
                      hasUnsavedChanges={hasUnsavedChanges}
                      lastSavedAt={lastSavedAt}
                    />
                  )}
                </div>
              ) : (
                <div
                  id="cv-preview-scroll"
                  className="flex-1 overflow-auto py-4 px-2 bg-muted/30"
                >
                  <div
                    className="scale-[0.45] origin-top-left"
                    style={{ width: "222%", transformOrigin: "top left" }}
                  >
                    <CvDocument cv={generated} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {/* Footer */}
      {hasContent && (
        <CvModalFooter
          isEditing={isEditing}
          hasUnsavedChanges={hasUnsavedChanges}
          lastSavedAt={lastSavedAt}
        />
      )}
    </div>
  );
}
