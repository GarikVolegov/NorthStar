import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { GROWTH_STATUS_FILTERS, growthStatusBadge } from "../adminReviewConfig";
import type { useGrowthQueue } from "../hooks/useGrowthQueue";

type GrowthQueueSectionProps = {
  growth: ReturnType<typeof useGrowthQueue>;
  auditActionLabel: (action: string) => string;
  fmtShortDate: (value: string | null | undefined) => string;
};

export function GrowthQueueSection({
  growth,
  auditActionLabel,
  fmtShortDate,
}: GrowthQueueSectionProps) {
  const previewText = (key: string) => String(growth.preview?.[key] ?? "");

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-serif font-bold">
            <Sparkles className="w-5 h-5 inline mr-2 text-primary" />
            Coda Crescita
          </h3>
          <p className="text-sm text-muted-foreground">
            Review editoriale per articoli generati o proposti.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={growth.load}
          disabled={growth.loading}
          className="min-h-11"
        >
          {growth.loading ? (
            <RefreshCw size={13} className="animate-spin mr-1" />
          ) : (
            <RefreshCw size={13} className="mr-1" />
          )}
          Aggiorna
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {GROWTH_STATUS_FILTERS.map((item) => {
          const value =
            item.value === "all"
              ? growth.data?.stats?.total
              : growth.data?.stats?.[item.value];
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => growth.setStatus(item.value)}
              className={cn(
                "min-h-11 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                growth.status === item.value
                  ? "bg-primary/10 border-primary/40"
                  : "bg-card hover:bg-muted/50",
              )}
            >
              <p className="text-lg font-bold">{value ?? 0}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 min-h-11"
          placeholder="Cerca titolo, slug, categoria o descrizione..."
          value={growth.search}
          onChange={(event) => growth.setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void growth.load();
          }}
        />
      </div>

      {growth.loading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : growth.data?.queue ? (
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] gap-4">
          <div className="space-y-2 min-w-0">
            {growth.data.queue.map((article) => (
              <button
                key={article.id}
                type="button"
                onClick={() => void growth.loadDetail(article.id)}
                className={cn(
                  "w-full min-h-11 text-left p-4 rounded-lg border bg-card hover:bg-muted/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  growth.selected?.article?.id === article.id &&
                    "border-primary/50 bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">
                      {article.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {article.slug} · {article.category}
                      {article.subcategory
                        ? ` / ${article.subcategory}`
                        : ""} · {article.readTimeMinutes} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {growthStatusBadge(article.status)}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {article.description}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Aggiornato {fmtShortDate(article.updatedAt)}
                </p>
              </button>
            ))}
            {growth.data.queue.length === 0 && (
              <div className="rounded-lg border bg-card p-8 text-center">
                <p className="font-medium">Nessun articolo trovato.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cambia filtro o ricerca per vedere altre proposte.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card min-w-0">
            {growth.selected ? (
              <div className="p-4 md:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold truncate">
                      {growth.selected.article.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {growthStatusBadge(growth.selected.article.status)}
                      <Badge variant="outline">
                        {growth.selected.article.difficulty}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {growth.selected.article.readTimeMinutes} min
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => growth.setSelected(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium mb-1">Titolo</p>
                    <Input
                      value={growth.form.title ?? ""}
                      onChange={(e) =>
                        growth.setForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                    />
                    {growth.fields.title && (
                      <p className="text-xs text-danger mt-1">
                        {growth.fields.title}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">Slug</p>
                    <Input
                      value={growth.form.slug ?? ""}
                      onChange={(e) =>
                        growth.setForm((prev) => ({
                          ...prev,
                          slug: e.target.value,
                        }))
                      }
                    />
                    {growth.fields.slug && (
                      <p className="text-xs text-danger mt-1">
                        {growth.fields.slug}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">Categoria</p>
                    <Input
                      value={growth.form.category ?? ""}
                      onChange={(e) =>
                        growth.setForm((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                    />
                    {growth.fields.category && (
                      <p className="text-xs text-danger mt-1">
                        {growth.fields.category}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">Sottocategoria</p>
                    <Input
                      value={growth.form.subcategory ?? ""}
                      onChange={(e) =>
                        growth.setForm((prev) => ({
                          ...prev,
                          subcategory: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">Difficoltà</p>
                    <select
                      className="w-full min-h-10 rounded-md border bg-background px-3 text-sm"
                      value={growth.form.difficulty ?? "base"}
                      onChange={(e) =>
                        growth.setForm((prev) => ({
                          ...prev,
                          difficulty: e.target.value,
                        }))
                      }
                    >
                      <option value="base">Base</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzato">Avanzato</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">Read time</p>
                    <Input
                      type="number"
                      min={1}
                      value={growth.form.readTimeMinutes ?? 3}
                      onChange={(e) =>
                        growth.setForm((prev) => ({
                          ...prev,
                          readTimeMinutes: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium mb-1">Descrizione</p>
                  <Textarea
                    value={growth.form.description ?? ""}
                    onChange={(e) =>
                      growth.setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                  {growth.fields.description && (
                    <p className="text-xs text-danger mt-1">
                      {growth.fields.description}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Contenuto</p>
                  <Textarea
                    className="min-h-40"
                    value={growth.form.content ?? ""}
                    onChange={(e) =>
                      growth.setForm((prev) => ({
                        ...prev,
                        content: e.target.value,
                      }))
                    }
                  />
                  {growth.fields.content && (
                    <p className="text-xs text-danger mt-1">
                      {growth.fields.content}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Tag</p>
                  <Input
                    value={
                      Array.isArray(growth.form.tags)
                        ? growth.form.tags.join(", ")
                        : (growth.form.tags ?? "")
                    }
                    onChange={(e) =>
                      growth.setForm((prev) => ({
                        ...prev,
                        tags: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void growth.runAction("save")}
                    disabled={!!growth.actionLoading}
                    className="min-h-11"
                  >
                    <Save className="w-4 h-4 mr-2" /> Salva modifiche
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void growth.runAction("preview")}
                    disabled={!!growth.actionLoading}
                    className="min-h-11"
                  >
                    <Eye className="w-4 h-4 mr-2" /> Preview
                  </Button>
                  <Button
                    onClick={() => void growth.runAction("publish")}
                    disabled={!!growth.actionLoading}
                    className="min-h-11"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approva e pubblica
                  </Button>
                </div>

                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-sm font-medium mb-2">Rifiuta con motivo</p>
                  <Textarea
                    value={growth.rejectReason}
                    onChange={(e) => growth.setRejectReason(e.target.value)}
                    placeholder="Motivo visibile nella timeline audit..."
                  />
                  {growth.fields.reason && (
                    <p className="text-xs text-danger mt-1">
                      {growth.fields.reason}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    className="mt-2 min-h-11 text-danger border-danger-muted hover:bg-danger-surface"
                    onClick={() => void growth.runAction("reject")}
                    disabled={!!growth.actionLoading}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Rifiuta
                  </Button>
                </div>

                {growth.preview && (
                  <div className="rounded-lg border p-4 bg-background">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Preview utente
                    </p>
                    <h5 className="font-serif font-bold text-lg">
                      {previewText("title")}
                    </h5>
                    <p className="text-sm text-muted-foreground mt-1">
                      {previewText("description")}
                    </p>
                    <div className="flex gap-2 flex-wrap mt-3">
                      <Badge variant="outline">{previewText("category")}</Badge>
                      <Badge variant="outline">
                        {previewText("difficulty")}
                      </Badge>
                      <Badge variant="outline">
                        {previewText("readTimeMinutes")} min
                      </Badge>
                    </div>
                    <p className="text-sm mt-4 whitespace-pre-wrap line-clamp-6">
                      {previewText("content")}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium mb-2">Timeline audit</p>
                  {growth.selected.auditTrail?.length ? (
                    <div className="space-y-2">
                      {growth.selected.auditTrail.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg border p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-medium">
                              {auditActionLabel(entry.action)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {fmtShortDate(entry.createdAt)}
                            </span>
                          </div>
                          {Boolean(
                            entry.metadata?.reason || entry.metadata?.notes,
                          ) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {String(
                                entry.metadata?.reason ?? entry.metadata?.notes,
                              )}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nessuna decisione registrata.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">Seleziona un articolo</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Apri una proposta per modificarla, vedere la preview e
                  decidere cosa pubblicare.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nessun dato disponibile.
          </p>
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={growth.load}
          >
            Riprova
          </Button>
        </div>
      )}
    </div>
  );
}
