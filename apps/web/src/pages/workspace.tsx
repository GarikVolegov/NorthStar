/**
 * workspace.tsx — lista e gestione workspace condivisi.
 *
 * Mostra i workspace dell'utente con link a dettaglio.
 * Creazione nuovo workspace (richiede piano Team).
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UpgradeGate } from "@/components/ui/UpgradeGate";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { API_ENDPOINTS } from "@/lib/constants";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, Heart, Loader2, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface WorkspaceItem {
  workspaceId: number;
  role:        string;
  name:        string;
  type:        string;
  isActive:    boolean;
}

const TYPE_META = {
  team:           { icon: Users,     label: "Team",           color: "text-blue-500" },
  mentor_mentee:  { icon: Heart,     label: "Mentor/Mentee",  color: "text-rose-500" },
};

async function fetchWorkspaces(): Promise<{ workspaces: WorkspaceItem[] }> {
  const res = await apiFetch(API_ENDPOINTS.workspaces.list);
  if (!res.ok) return { workspaces: [] };
  return res.json();
}

async function createWorkspace(data: { name: string; type: string; description?: string }) {
  const res = await apiFetch(API_ENDPOINTS.workspaces.create, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function WorkspacePage() {
  usePageMeta({ title: "Workspace — NorthStar", description: "I tuoi spazi di lavoro condivisi" });

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [newType, setNewType]       = useState<"team" | "mentor_mentee">("team");

  const { data, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn:  fetchWorkspaces,
    enabled:  !!user,
  });

  const createMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setShowCreate(false);
      setNewName("");
    },
  });

  const workspaces = data?.workspaces ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workspace</h1>
            <p className="text-sm text-muted-foreground">Spazi di lavoro condivisi con team e mentori</p>
          </div>
        </div>

        <UpgradeGate feature="workspace_shared" plan="team" compact>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-2">
            <Plus className="h-4 w-4" /> Nuovo workspace
          </Button>
        </UpgradeGate>
      </div>

      {/* Crea nuovo workspace */}
      {showCreate && (
        <div className="rounded-xl border border-dashed p-5 space-y-3 bg-muted/20">
          <h3 className="font-semibold text-sm">Crea workspace</h3>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome del workspace (es. Team AI 2025, Mentor Mario)"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setNewType("team")}
              className={cn("flex-1 text-xs py-2 rounded-lg border transition-all",
                newType === "team" ? "border-primary/50 bg-primary/5 text-primary" : "border-border text-muted-foreground")}
            >
              <Users className="h-4 w-4 mx-auto mb-1" /> Team
            </button>
            <button
              onClick={() => setNewType("mentor_mentee")}
              className={cn("flex-1 text-xs py-2 rounded-lg border transition-all",
                newType === "mentor_mentee" ? "border-rose-500/50 bg-rose-500/5 text-rose-500" : "border-border text-muted-foreground")}
            >
              <Heart className="h-4 w-4 mx-auto mb-1" /> Mentor/Mentee
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => createMutation.mutate({ name: newName.trim(), type: newType })}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Annulla</Button>
          </div>
        </div>
      )}

      {/* Lista workspace */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center space-y-3">
          <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="font-semibold text-foreground">Nessun workspace</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Crea il tuo primo workspace per collaborare con il tuo team o connetterti con un mentore.
          </p>
          <div className="flex justify-center">
            <UpgradeGate feature="workspace_shared" plan="team" compact message="I workspace condivisi sono disponibili nel piano Team.">
              <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Crea workspace
              </Button>
            </UpgradeGate>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {workspaces.map((ws) => {
            const meta = TYPE_META[ws.type as keyof typeof TYPE_META] ?? TYPE_META.team;
            const Icon = meta.icon;
            return (
              <Link key={ws.workspaceId} href={`/workspace/${ws.workspaceId}`}>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/20 transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Icon className={cn("h-5 w-5", meta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{ws.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{meta.label}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground capitalize">{ws.role}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
