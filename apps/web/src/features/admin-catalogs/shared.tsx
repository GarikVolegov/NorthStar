import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit3, Trash2 } from "lucide-react";

export function ArrayField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">
        {label} (separati da virgola)
      </label>
      <Input
        className="mt-1 text-xs"
        value={value.join(", ")}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
      />
    </div>
  );
}

export function ListRow({
  label,
  sub,
  active,
  onEdit,
  onDelete,
}: {
  label: string;
  sub?: string;
  active?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      {active !== undefined && (
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${active ? "border-success-muted text-success" : "text-muted-foreground"}`}
        >
          {active ? "Attivo" : "Inattivo"}
        </Badge>
      )}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={onEdit}
        >
          <Edit3 size={13} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-danger hover:text-danger"
          onClick={onDelete}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}
