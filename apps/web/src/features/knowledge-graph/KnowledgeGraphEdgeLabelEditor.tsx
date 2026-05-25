import { Check } from "lucide-react";
import type { EdgeLabelEdit } from "./knowledgeGraphTypes";

interface KnowledgeGraphEdgeLabelEditorProps {
  edgeLabelEdit: EdgeLabelEdit;
  onChange: (value: EdgeLabelEdit | null | ((prev: EdgeLabelEdit | null) => EdgeLabelEdit | null)) => void;
  onSave: (edgeId: number, label: string) => Promise<void>;
}

export function KnowledgeGraphEdgeLabelEditor({
  edgeLabelEdit,
  onChange,
  onSave,
}: KnowledgeGraphEdgeLabelEditorProps) {
  const commit = async () => {
    await onSave(edgeLabelEdit.edgeId, edgeLabelEdit.draft);
    onChange(null);
  };

  return (
    <div
      className="fixed z-70 flex items-center gap-1"
      style={{
        left: edgeLabelEdit.screenX - 70,
        top: edgeLabelEdit.screenY - 14,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <input
        autoFocus
        type="text"
        value={edgeLabelEdit.draft}
        onChange={(event) =>
          onChange((prev) => (prev ? { ...prev, draft: event.target.value } : null))
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") void commit();
          if (event.key === "Escape") onChange(null);
        }}
        onBlur={() => void commit()}
        placeholder="etichetta..."
        className="h-6 w-36 rounded-lg border border-primary bg-card px-2 text-[11px] shadow-md outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => void commit()}
        className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90"
      >
        <Check className="h-3 w-3" />
      </button>
    </div>
  );
}
