import { AdminAuthGate } from "@/components/AdminAuthGate";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { CatalogList } from "@/features/admin-catalogs/CatalogList";
import { useAdminCatalog } from "@/features/admin-catalogs/useAdminCatalog";
import {
  BookOpen,
  Briefcase,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { useState } from "react";
import type {
  CatalogTab,
  CatalogTabConfig,
  EducationPath,
  GrowthArticle,
  Profession,
  Sector,
} from "@/features/admin-catalogs/types";

const TABS: CatalogTabConfig[] = [
  { id: "sectors", label: "Aree", icon: <Briefcase size={14} /> },
  { id: "professions", label: "Professioni", icon: <Users size={14} /> },
  {
    id: "education-paths",
    label: "Percorsi",
    icon: <GraduationCap size={14} />,
  },
  {
    id: "growth-articles",
    label: "Articoli Crescita",
    icon: <BookOpen size={14} />,
  },
];

export default function AdminCataloghi() {
  const { key } = useAdminAuth();
  const [tab, setTab] = useState<CatalogTab>("sectors");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const resources = {
    sectors: useAdminCatalog<Sector>("sectors", key),
    professions: useAdminCatalog<Profession>("professions", key),
    "education-paths": useAdminCatalog<EducationPath>("education-paths", key),
    "growth-articles": useAdminCatalog<GrowthArticle>("growth-articles", key),
  };
  const current = resources[tab];

  function selectTab(nextTab: CatalogTab) {
    setTab(nextTab);
    setCreating(false);
    setEditingId(null);
  }

  return (
    <AdminAuthGate
      title="Cataloghi"
      description="Gestisci settori, professioni, percorsi e articoli"
    >
      <div className="min-h-screen bg-muted/20 p-4 md:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <BookOpen size={22} className="text-primary" />
                Cataloghi
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Gestisci settori, professioni, percorsi e articoli
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void current.refresh()}
                disabled={current.loading}
              >
                {current.loading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setCreating(true);
                  setEditingId(null);
                }}
              >
                <Plus size={13} className="mr-1" /> Nuovo
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.icon} {item.label}
                <span className="ml-1 text-xs font-normal opacity-60">
                  ({resources[item.id].data.length})
                </span>
              </button>
            ))}
          </div>

          <CatalogList
            tab={tab}
            adminKey={key}
            resources={resources}
            creating={creating}
            editingId={editingId}
            onCreatingChange={setCreating}
            onEditingIdChange={setEditingId}
          />

          <div className="flex gap-2 pt-2 text-xs text-muted-foreground">
            <a href="/admin" className="hover:underline">
              Admin Home
            </a>
            <span>-</span>
            <a href="/admin/crescita" className="hover:underline">
              Coda Crescita
            </a>
            <span>-</span>
            <a href="/admin/agenti" className="hover:underline">
              Agent Health
            </a>
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}
