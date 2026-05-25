import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GraphNode } from "@/pages/grafo-types";
import { Plus, X } from "lucide-react";
import { NODE_CONFIG, TYPE_OPTIONS } from "./sectorGraphConfig";

export interface SectorGraphAddForm {
  type: "role" | "skill" | "tool" | "certification";
  label: string;
  description: string;
  connectTo: string;
}

interface SectorGraphAddPanelProps {
  addForm: SectorGraphAddForm;
  allNodes: GraphNode[];
  onChange: (updater: (form: SectorGraphAddForm) => SectorGraphAddForm) => void;
  onAdd: () => void;
  onClose: () => void;
  t: (key: string) => string;
}

export function SectorGraphAddPanel({
  addForm,
  allNodes,
  onChange,
  onAdd,
  onClose,
  t,
}: SectorGraphAddPanelProps) {
  return (
    <div className="mb-5 animate-in rounded-2xl border bg-card p-5 fade-in slide-in-from-top-2 duration-200">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("grafo.addNodeTitle")}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t("grafo.nodeTypeLabel")}
          </label>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange((form) => ({ ...form, type: opt.value }))}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                  addForm.type === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40",
                )}
              >
                {opt.emoji} {t(`grafo.nodeTypes.${opt.value}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t("grafo.connectTo")}
          </label>
          <select
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={addForm.connectTo}
            onChange={(event) => onChange((form) => ({ ...form, connectTo: event.target.value }))}
          >
            <option value="">{t("grafo.noConnection")}</option>
            {allNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {NODE_CONFIG[node.type]?.emoji} {node.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t("grafo.nodeName")}
          </label>
          <input
            type="text"
            placeholder={`es. "${addForm.type === "role" ? "Product Manager" : addForm.type === "skill" ? "Agile Scrum" : addForm.type === "tool" ? "Jira" : "PMP"}"`}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={addForm.label}
            onChange={(event) => onChange((form) => ({ ...form, label: event.target.value }))}
            onKeyDown={(event) => event.key === "Enter" && onAdd()}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t("grafo.nodeDescription")}
          </label>
          <input
            type="text"
            placeholder={t("grafo.nodeDescPlaceholder")}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={addForm.description}
            onChange={(event) => onChange((form) => ({ ...form, description: event.target.value }))}
            onKeyDown={(event) => event.key === "Enter" && onAdd()}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={onClose}>
          {t("grafo.cancel")}
        </Button>
        <Button size="sm" className="rounded-xl" onClick={onAdd} disabled={!addForm.label.trim()}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("grafo.addNode")}
        </Button>
      </div>
    </div>
  );
}
