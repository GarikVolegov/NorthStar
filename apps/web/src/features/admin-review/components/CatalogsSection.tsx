import { PersistenceWarningBanner } from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Archive, BookOpen, CheckCircle2, Eye, FileText, Filter, RefreshCw, RotateCcw, Save, Search } from "lucide-react";
import {
  CATALOG_TABS,
  catalogDescription,
  catalogTitle,
  isCatalogArchived,
} from "../adminReviewConfig";
import type { useAdminCatalogs } from "../hooks/useAdminCatalogs";

type CatalogsSectionProps = {
  catalogs: ReturnType<typeof useAdminCatalogs>;
  onOpenStatus: () => void;
};

export function CatalogsSection({ catalogs, onOpenStatus }: CatalogsSectionProps) {
  const catalogOverviewByType = new Map(catalogs.overview.map((item) => [item.type, item]));

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Cataloghi core
          </h3>
          <p className="text-sm text-muted-foreground">
            Editing controllato con bozze, preview utente, pubblicazione e audit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="min-h-11"
            onClick={() => catalogs.openDraft(catalogs.type)}
          >
            <FileText size={14} className="mr-1.5" />
            Nuova bozza
          </Button>
          <Button size="sm" variant="outline" className="min-h-11" onClick={catalogs.load} disabled={catalogs.loading}>
            {catalogs.loading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
            Aggiorna
          </Button>
        </div>
      </div>

      <PersistenceWarningBanner
        meta={catalogs.persistence}
        title="Cataloghi non affidabili"
        onRetry={catalogs.load}
        onOpenStatus={onOpenStatus}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CATALOG_TABS.map(({ type, label, icon: Icon }) => {
          const overview = catalogOverviewByType.get(type);
          const active = catalogs.type === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => catalogs.selectType(type)}
              className={cn(
                "min-h-24 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                active ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between">
                <Icon className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground")} />
                {overview && overview.drafts > 0 && (
                  <Badge variant="outline">{overview.drafts} bozze</Badge>
                )}
              </div>
              <p className="mt-3 font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">
                {overview ? `${overview.active} attivi · ${overview.archived} archiviati` : "Caricamento"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="min-h-11 pl-9"
            value={catalogs.search}
            onChange={(event) => catalogs.setSearch(event.target.value)}
            placeholder="Cerca per titolo, nome o descrizione"
          />
        </div>
        <select
          className="min-h-11 rounded-md border bg-background px-3 text-sm"
          value={catalogs.status}
          onChange={(event) => catalogs.setStatus(event.target.value)}
          aria-label="Filtra stato catalogo"
        >
          <option value="all">Tutti gli stati</option>
          <option value="active">Attivi</option>
          <option value="archived">Archiviati</option>
          {catalogs.type === "growth_articles" && <option value="draft">Draft articoli</option>}
          {catalogs.type === "growth_articles" && <option value="published">Pubblicati</option>}
        </select>
        <Button className="min-h-11" variant="outline" onClick={catalogs.load} disabled={catalogs.loading}>
          <Filter size={14} className="mr-1.5" />
          Filtra
        </Button>
      </div>

      {Object.keys(catalogs.fields).length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p className="font-semibold">Correggi questi problemi prima di continuare:</p>
          <ul className="mt-1 list-disc pl-5">
            {Object.entries(catalogs.fields).map(([field, message]) => (
              <li key={field}>
                <span className="font-medium">{field}</span>: {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{catalogs.data?.label ?? "Catalogo"}</p>
              <p className="text-xs text-muted-foreground">
                {(catalogs.data?.items?.length ?? 0)} elementi · {(catalogs.data?.drafts?.length ?? 0)} bozze aperte
              </p>
            </div>
            {catalogs.loading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="divide-y max-h-[620px] overflow-y-auto">
            {catalogs.loading ? (
              <p className="p-6 text-sm text-muted-foreground">Caricamento catalogo...</p>
            ) : catalogs.data && catalogs.data.items.length > 0 ? (
              catalogs.data.items.map((item) => {
                const archived = isCatalogArchived(catalogs.type, item);
                const active = catalogs.selected?.id === item.id;
                return (
                  <button
                    key={`${catalogs.type}:${item.id}`}
                    type="button"
                    onClick={() => void catalogs.openItem(item)}
                    className={cn(
                      "w-full min-h-20 p-4 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      active && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{catalogTitle(catalogs.type, item)}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {catalogDescription(catalogs.type, item)}
                        </p>
                      </div>
                      <Badge variant="outline" className={archived ? "text-slate-500" : "text-emerald-700"}>
                        {archived ? "Archiviato" : catalogs.type === "growth_articles" ? String(item.status) : "Attivo"}
                      </Badge>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {catalogs.persistence.persistenceUnavailable
                  ? "Catalogo non leggibile: controlla setup o migration prima di interpretare questo vuoto."
                  : "Nessun elemento trovato. Crea una bozza o cambia filtro."}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border bg-card">
            <div className="border-b px-4 py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {catalogs.selected ? catalogTitle(catalogs.type, catalogs.selected) : "Nuova bozza"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {catalogs.draftId ? `Bozza #${catalogs.draftId} pronta per pubblicazione` : "Salva una bozza prima di pubblicare un nuovo contenuto."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="min-h-11" onClick={() => void catalogs.runAction("preview")} disabled={catalogs.actionLoading === "preview"}>
                  <Eye size={14} className="mr-1.5" />
                  Preview
                </Button>
                <Button size="sm" className="min-h-11" onClick={() => void catalogs.runAction("draft")} disabled={catalogs.actionLoading === "draft"}>
                  <Save size={14} className="mr-1.5" />
                  Salva bozza
                </Button>
                <Button size="sm" className="min-h-11" onClick={() => void catalogs.runAction("publish")} disabled={catalogs.actionLoading === "publish"}>
                  <CheckCircle2 size={14} className="mr-1.5" />
                  Pubblica
                </Button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-sm font-medium" htmlFor="catalog-notes">Note decisione</label>
              <Input
                id="catalog-notes"
                className="min-h-11"
                value={catalogs.notes}
                onChange={(event) => catalogs.setNotes(event.target.value)}
                placeholder="Motivo modifica, fonte dati o contesto editoriale"
              />
              <label className="block text-sm font-medium" htmlFor="catalog-payload">Payload validato</label>
              <textarea
                id="catalog-payload"
                className="min-h-[360px] w-full resize-y rounded-md border bg-background p-3 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                value={catalogs.payloadText}
                onChange={(event) => catalogs.setPayloadText(event.target.value)}
                spellCheck={false}
              />
            </div>
            {catalogs.selected && Boolean(catalogs.selected.id) && (
              <div className="border-t px-4 py-3 flex flex-wrap gap-2">
                {isCatalogArchived(catalogs.type, catalogs.selected) ? (
                  <Button size="sm" variant="outline" className="min-h-11" onClick={() => void catalogs.runAction("restore")} disabled={catalogs.actionLoading === "restore"}>
                    <RotateCcw size={14} className="mr-1.5" />
                    Ripristina
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="min-h-11 text-red-700" onClick={() => void catalogs.runAction("archive")} disabled={catalogs.actionLoading === "archive"}>
                    <Archive size={14} className="mr-1.5" />
                    Archivia
                  </Button>
                )}
                <a
                  className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted/40"
                  href={
                    catalogs.type === "growth_articles" && catalogs.selected.slug
                      ? `/crescita/articolo/${String(catalogs.selected.slug)}`
                      : catalogs.type === "sectors"
                        ? `/settore/${String(catalogs.selected.id)}`
                        : catalogs.type === "professions"
                          ? `/ruolo/${String(catalogs.selected.id)}`
                          : "/percorso"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <Eye size={14} className="mr-1.5" />
                  Apri vista utente
                </a>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border bg-card p-4">
              <p className="text-sm font-semibold mb-3">Preview utente</p>
              {catalogs.preview ? (
                <div className="rounded-md border bg-background p-4">
                  <p className="text-xs text-muted-foreground">{catalogs.preview.subtitle}</p>
                  <h4 className="mt-1 font-serif text-lg font-bold">{catalogs.preview.title}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{catalogs.preview.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {catalogs.preview.badges?.slice(0, 6).map((badge) => (
                      <Badge key={badge} variant="outline">{badge}</Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Genera una preview per vedere come apparira agli utenti prima della pubblicazione.</p>
              )}
            </div>

            <div className="rounded-md border bg-card p-4">
              <p className="text-sm font-semibold mb-3">Audit recente</p>
              {catalogs.auditTrail.length > 0 ? (
                <div className="space-y-2">
                  {catalogs.auditTrail.slice(0, 5).map((entry) => (
                    <div key={String(entry.id)} className="rounded-md border bg-background p-3">
                      <p className="text-xs font-mono">{String(entry.action)}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.createdAt ? new Date(String(entry.createdAt)).toLocaleString("it-IT") : "Data non disponibile"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Le decisioni su questo elemento appariranno qui.</p>
              )}
            </div>
          </div>

          {catalogs.data?.drafts && catalogs.data.drafts.length > 0 && (
            <div className="rounded-md border bg-card p-4">
              <p className="text-sm font-semibold mb-3">Bozze aperte</p>
              <div className="grid gap-2">
                {catalogs.data.drafts.slice(0, 6).map((draft) => (
                  <button
                    key={draft.id}
                    type="button"
                    onClick={() => catalogs.openExistingDraft(draft)}
                    className="min-h-14 rounded-md border bg-background p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <p className="text-sm font-medium">
                      Bozza #{draft.id} {draft.entityId ? `· elemento #${draft.entityId}` : "· nuovo elemento"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Aggiornata {new Date(draft.updatedAt).toLocaleString("it-IT")}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
