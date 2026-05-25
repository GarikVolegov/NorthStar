/**
 * CvDownloadMenu
 * Dropdown per scaricare il CV in 3 formati: PDF, DOCX, JSON
 */
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, File, FileJson, FileText } from "lucide-react";
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
  function downloadPdf() {
    const a = document.createElement("a");
    a.href = `${BASE}api/cv/${userId}/pdf?template=${template}`;
    a.download = filename;
    a.click();
  }

  function downloadDocx() {
    const a = document.createElement("a");
    a.href = `${BASE}api/cv/${userId}/docx?template=${template}`;
    a.download = filename.replace(/\.pdf$/i, ".docx");
    a.click();
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
        <DropdownMenuItem onClick={downloadPdf} className="gap-2 text-xs cursor-pointer">
          <FileText className="w-3.5 h-3.5 text-red-500" />
          PDF
          <span className="ml-auto text-[10px] text-muted-foreground">Template {template}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadDocx} className="gap-2 text-xs cursor-pointer">
          <File className="w-3.5 h-3.5 text-blue-500" />
          Word (DOCX)
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
