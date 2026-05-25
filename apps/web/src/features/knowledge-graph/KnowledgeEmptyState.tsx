import { TYPE_META } from "@/components/knowledge-graph/types";
import { Upload } from "lucide-react";
import { memo } from "react";
import type { NodeType } from "./knowledgeGraphTypes";

export const KnowledgeEmptyState = memo(function KnowledgeEmptyState({
  onAdd,
  onImport,
}: {
  onAdd: (type?: NodeType) => void;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-16 max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 text-3xl">
        📚
      </div>
      <h2 className="font-serif font-bold text-xl mb-2">
        Il tuo Archivio \u00e8 vuoto
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
        Qui raccoglierai tutto quello che impari: note, competenze, documenti,
        idee. Ogni elemento si collega agli altri \u2014 costruisci la mappa del
        tuo percorso.
      </p>
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm mb-6">
        {(["note", "skill", "document"] as NodeType[]).map((t) => {
          const m = TYPE_META[t];
          const Icon = m.Icon;
          return (
            <button
              key={t}
              onClick={() => onAdd(t)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: m.bg }}
              >
                <Icon className="w-4 h-4" style={{ color: m.color }} />
              </div>
              <span className="text-xs font-medium">{m.label}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onImport}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border rounded-xl px-4 py-2 hover:border-primary/40 transition-colors"
      >
        <Upload className="w-4 h-4" /> Oppure importa un file esistente
      </button>
    </div>
  );
});
