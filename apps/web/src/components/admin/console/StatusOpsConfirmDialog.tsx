import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminOpsAction } from "./types";

const OPS_CONFIRMATION: Record<
  AdminOpsAction,
  { title: string; label: string; description: string }
> = {
  "server-start": {
    title: "Accendi server",
    label: "ACCENDI SERVER",
    description:
      "Avvia il servizio northstar-server tramite Docker Compose, se il control plane e disponibile.",
  },
  "server-stop": {
    title: "Spegni server",
    label: "SPEGNI SERVER",
    description:
      "Spegne il backend. Dopo questa azione la console potrebbe non rispondere finche il servizio non viene riavviato.",
  },
  "server-restart": {
    title: "Riavvia server",
    label: "RIAVVIA SERVER",
    description:
      "Riavvia il backend NorthStar. Le richieste in corso possono essere interrotte.",
  },
  "database-restart": {
    title: "Riavvia database",
    label: "RIAVVIA DATABASE",
    description:
      "Riavvia Postgres via Docker Compose. Usa prima la maintenance mode se ci sono utenti attivi.",
  },
};

type StatusOpsConfirmDialogProps = {
  action: AdminOpsAction | null;
  confirmation: string;
  loading: boolean;
  onConfirmationChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function StatusOpsConfirmDialog({
  action,
  confirmation,
  loading,
  onConfirmationChange,
  onCancel,
  onConfirm,
}: StatusOpsConfirmDialogProps) {
  const config = action ? OPS_CONFIRMATION[action] : null;

  return (
    <AlertDialog
      open={Boolean(action)}
      onOpenChange={(open) => !open && onCancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config?.title}</AlertDialogTitle>
          <AlertDialogDescription>{config?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <p className="text-sm">
            Scrivi{" "}
            <span className="font-mono font-semibold">{config?.label}</span> per
            confermare.
          </p>
          <Input
            value={confirmation}
            onChange={(event) => onConfirmationChange(event.target.value)}
            placeholder={config?.label}
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Annulla</AlertDialogCancel>
          <Button
            type="button"
            variant={action === "server-stop" ? "destructive" : "default"}
            disabled={!config || confirmation !== config.label || loading}
            onClick={onConfirm}
          >
            Conferma
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
