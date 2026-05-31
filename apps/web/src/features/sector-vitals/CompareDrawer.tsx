import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePinSector, usePinnedSectors, useUnpinSector } from "@workspace/api-client-react";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { VitalSignsRow } from "./VitalSignsRow";

interface CompareDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSectorId: number;
  currentSectorName: string;
}

export function CompareDrawer({
  open,
  onOpenChange,
  currentSectorId,
  currentSectorName,
}: CompareDrawerProps) {
  const pinned = usePinnedSectors();
  const pin = usePinSector();
  const unpin = useUnpinSector();
  const pinnedSectors = pinned.data?.pinnedSectors ?? [];
  const isPinned = pinnedSectors.some((item) => item.sectorId === currentSectorId);

  async function togglePin() {
    try {
      if (isPinned) {
        await unpin.mutateAsync(currentSectorId);
      } else {
        await pin.mutateAsync(currentSectorId);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non posso pinnare questo settore");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-5xl">
        <SheetHeader className="border-b px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <SheetTitle>Confronta settori</SheetTitle>
              <SheetDescription>Fino a 3 settori pinnati con monitor vitale compatto.</SheetDescription>
            </div>
            <Button size="sm" variant={isPinned ? "outline" : "default"} onClick={() => void togglePin()}>
              {isPinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
              {isPinned ? "Rimuovi pin" : "Pinna questo settore"}
            </Button>
          </div>
        </SheetHeader>

        <div className="grid gap-4 p-5 lg:grid-cols-3">
          {pinnedSectors.length === 0 ? (
            <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
              Nessun settore pinnato.
            </div>
          ) : (
            pinnedSectors.map((sector) => (
              <div key={sector.sectorId} className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{sector.sectorName ?? `Settore ${sector.sectorId}`}</h3>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Rimuovi settore pinnato"
                    onClick={() => void unpin.mutateAsync(sector.sectorId)}
                  >
                    <PinOff className="h-4 w-4" />
                  </Button>
                </div>
                <VitalSignsRow
                  sectorId={sector.sectorId}
                  sectorName={sector.sectorName ?? `Settore ${sector.sectorId}`}
                  compact
                  showSummary={false}
                  enableDetails={false}
                />
              </div>
            ))
          )}
          {!isPinned && pinnedSectors.length < 3 && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4">
              <h3 className="mb-3 text-sm font-semibold">{currentSectorName}</h3>
              <VitalSignsRow
                sectorId={currentSectorId}
                sectorName={currentSectorName}
                compact
                showSummary={false}
                enableDetails={false}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
