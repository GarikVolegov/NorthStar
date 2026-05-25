import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Download, Loader2, Plus, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface SectorGraphHeaderProps {
  sectorId: number;
  sectorName?: string | undefined;
  hasGraph: boolean;
  hasPositionedNodes: boolean;
  isExporting: boolean;
  isLoading: boolean;
  onExportPng: () => void;
  onRefresh: () => void;
  onToggleAddPanel: () => void;
  t: (key: string) => string;
}

export function SectorGraphHeader({
  sectorId,
  sectorName,
  hasGraph,
  hasPositionedNodes,
  isExporting,
  isLoading,
  onExportPng,
  onRefresh,
  onToggleAddPanel,
  t,
}: SectorGraphHeaderProps) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" asChild>
        <Link href={`/settore/${sectorId}`}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate font-serif text-2xl font-bold">{t("grafo.title")}</h1>
          <Badge variant="outline" className="shrink-0 border-primary/20 bg-primary/5 px-1.5 py-0 text-[10px] text-primary">
            <Sparkles className="mr-1 h-2 w-2" />
            Premium
          </Badge>
        </div>
        {sectorName && <p className="text-sm text-muted-foreground">{sectorName}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {hasGraph && hasPositionedNodes && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={onExportPng}
            disabled={isExporting}
            title={t("grafo.downloadPng")}
          >
            {isExporting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isExporting ? t("grafo.exporting") : "PNG"}
          </Button>
        )}
        {hasGraph && (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isLoading && "animate-spin")} />
            {t("grafo.regenerate")}
          </Button>
        )}
        {hasGraph && (
          <Button size="sm" className="rounded-xl" onClick={onToggleAddPanel}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("grafo.addNode")}
          </Button>
        )}
      </div>
    </div>
  );
}
