/**
 * CvDownloadMenu
 * Dropdown per scaricare il CV. PDF (stampabile) è gated a Pro; JSON è sempre
 * disponibile (dati raw). DOCX non è ancora implementato lato server.
 */
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api-fetch";
import { useSubscription } from "@/hooks/useSubscription";
import { Download, File, FileJson, FileText, Lock } from "lucide-react";
import { useLocation } from "wouter";
import type { GeneratedCv } from "./CvEditorDrawer";

const BASE = import.meta.env.BASE_URL || "/";

type CvTemplate = "classic" | "minimal" | "bold";

interface Props {
  userId: number;
  template: CvTemplate;
  filename: string;
  generatedCv?: GeneratedCv | null;
  /** Optional: render as icon-only (no label) */
  iconOnly?: boolean;
}

export function CvDownloadMenu({ userId, template, filename, generatedCv, iconOnly }: Props) {
  const [, setLocation] = useLocation();
  const { canAccess } = useSubscription();
  const canPdf = canAccess("export_plan_pdf");

  // Il PDF è gated (Pro): l'endpoint richiede auth (apiFetch inietta il token) e
  // restituisce un documento stampabile che apriamo in una nuova finestra
  // (window.print → "Salva come PDF"). I free vengono mandati al paywall.
  async function downloadPdf() {
    if (!canPdf) {
      setLocation("/premium");
      return;
    }
    // Apri la finestra SINCRONICAMENTE nel gesto del click: aprirla dopo l'await
    // verrebbe bloccata dai popup blocker.
    const w = window.open("", "_blank", "width=820,height=1060");
    try {
      const res = await apiFetch(`${BASE}api/cv/${userId}/pdf?template=${template}`);
      if (res.status === 402) {
        w?.close();
        setLocation("/premium");
        return;
      }
      if (!res.ok) {
        w?.close();
        return;
      }
      const html = await res.text();
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch {
      w?.close();
    }
  }

  function downloadJson() {
    if (!generatedCv) return;
    const blob = new Blob([JSON.stringify(generatedCv, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.pdf$/i, ".json");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-1.5 rounded-lg h-auto"
          title="Scarica CV"
        >
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
          {!iconOnly && <span className="sr-only">Scarica</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Scarica come</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { void downloadPdf(); }} className="gap-2 text-xs cursor-pointer">
          <FileText className="w-3.5 h-3.5 text-red-500" />
          PDF
          {canPdf ? (
            <span className="ml-auto text-[10px] text-muted-foreground">Template {template}</span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
              <Lock className="w-3 h-3" /> Pro
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="gap-2 text-xs">
          <File className="w-3.5 h-3.5 text-blue-500" />
          Word (DOCX)
          <span className="ml-auto text-[10px] text-muted-foreground">presto</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadJson} disabled={!generatedCv} className="gap-2 text-xs cursor-pointer">
          <FileJson className="w-3.5 h-3.5 text-yellow-500" />
          JSON
          <span className="ml-auto text-[10px] text-muted-foreground">dati raw</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
