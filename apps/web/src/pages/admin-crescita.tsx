import { AdminAuthGate } from "@/components/AdminAuthGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiFetch } from "@/lib/api-fetch";
import { getJson } from "@/lib/apiClient";
import {
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

interface GrowthArticle {
  id: number;
  title: string;
  slug: string;
  category: string;
  subcategory?: string;
  description: string;
  content: string;
  tags: string[];
  difficulty: string;
  personalityMatches: string[];
  sectorLinks: string[];
  status: string;
  readTimeMinutes: number;
  createdAt: string;
  updatedAt: string;
}

interface QueueData {
  queue: GrowthArticle[];
  stats: { pending: number; published: number; rejected: number };
}

function difficultyBadge(d: string) {
  if (d === "base")
    return <Badge className="bg-info-surface text-info text-xs">Base</Badge>;
  if (d === "intermedio")
    return (
      <Badge className="bg-warning-surface text-warning text-xs">
        Intermedio
      </Badge>
    );
  return <Badge className="bg-info-surface text-info text-xs">Avanzato</Badge>;
}

function EditModal({
  article,
  adminKey,
  onClose,
  onSaved,
}: {
  article: GrowthArticle;
  adminKey: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(article.title);
  const [description, setDescription] = useState(article.description);
  const [content, setContent] = useState(article.content);
  const [saving, setSaving] = useState(false);

  async function handleApprove() {
    setSaving(true);
    try {
      await apiFetch(`${BASE}api/admin/growth-queue/${article.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description, content }),
      });
      await apiFetch(`${BASE}api/admin/growth-queue/${article.id}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: "Pubblicato dalla pagina admin crescita legacy." }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Modifica e Approva</CardTitle>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Titolo
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Descrizione
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Contenuto
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 font-mono text-xs"
              rows={10}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 bg-success text-primary-foreground hover:bg-success/90"
              onClick={handleApprove}
              disabled={saving}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <CheckCircle2 size={14} className="mr-1" />
              )}
              Approva e Pubblica
            </Button>
            <Button variant="outline" onClick={onClose}>
              Annulla
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ArticleCard({
  article,
  adminKey,
  onRefresh,
}: {
  article: GrowthArticle;
  adminKey: string;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  async function approve() {
    setLoading(true);
    try {
      await apiFetch(`${BASE}api/admin/growth-queue/${article.id}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    setLoading(true);
    try {
      await apiFetch(`${BASE}api/admin/growth-queue/${article.id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Scartato dalla pagina admin crescita legacy." }),
      });
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!confirm("Scartare questo articolo dalla coda?")) return;
    setLoading(true);
    try {
      await apiFetch(`${BASE}api/admin/growth-queue/${article.id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Rimosso dalla coda tramite pagina admin crescita legacy." }),
      });
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {editing && (
        <EditModal
          article={article}
          adminKey={adminKey}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onRefresh();
          }}
        />
      )}
      <Card className="border hover:shadow-sm transition-shadow">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight">
                {article.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {article.category}
                {article.subcategory ? ` / ${article.subcategory}` : ""}
                {" Â· "}
                <span className="flex items-center gap-0.5 inline-flex">
                  <Clock size={10} /> {article.readTimeMinutes} min
                </span>
                {" Â· "}
                {new Date(article.createdAt).toLocaleDateString("it-IT")}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {difficultyBadge(article.difficulty)}
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {article.description}
          </p>

          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {article.tags.slice(0, 5).map((t) => (
                <span
                  key={t}
                  className="text-xs bg-muted px-2 py-0.5 rounded-full"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              className="bg-success text-primary-foreground hover:bg-success/90 h-7 text-xs"
              onClick={approve}
              disabled={loading}
            >
              <CheckCircle2 size={12} className="mr-1" /> Approva
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setEditing(true)}
              disabled={loading}
            >
              <Edit3 size={12} className="mr-1" /> Modifica
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-warning border-warning-muted"
              onClick={reject}
              disabled={loading}
            >
              <XCircle size={12} className="mr-1" /> Scarta
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-danger ml-auto"
              onClick={remove}
              disabled={loading}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function AdminCrescita() {
  const { key } = useAdminAuth();
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (adminKey: string) => {
    setLoading(true);
    try {
      const queueData = await getJson<QueueData>(`${BASE}api/admin/growth-queue`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      setData(queueData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (key) fetchData(key);
  }, [key, fetchData]);

  return (
    <AdminAuthGate
      title="Coda Crescita"
      description="Approva, modifica o scarta articoli generati dall'AI"
    >
      <div className="min-h-screen bg-muted/20 p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles size={22} className="text-primary" />
                Coda Articoli Crescita
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Approva, modifica o scarta articoli generati dall'AI
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(key)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <RefreshCw size={14} className="mr-1" />
              )}
              Aggiorna
            </Button>
          </div>

          {/* Stats */}
          {data && (
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-warning">
                    {data.stats.pending}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">In coda</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-success">
                    {data.stats.published}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <TrendingUp size={10} /> Pubblicati
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-danger">
                    {data.stats.rejected}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Scartati</p>
                </CardContent>
              </Card>
            </div>
          )}

          {loading && !data && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          )}

          {data && data.queue.length === 0 && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
                <CheckCircle2
                  size={32}
                  className="mx-auto mb-3 text-success opacity-60"
                />
                <p className="font-medium">Nessun articolo in coda</p>
                <p className="text-sm mt-1">
                  Gli articoli generati dall'AI con status "pending" appariranno
                  qui.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {data?.queue.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                adminKey={key}
                onRefresh={() => fetchData(key)}
              />
            ))}
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground pt-2">
            <a href="/admin" className="hover:underline">
              â† Admin Home
            </a>
            <span>Â·</span>
            <a href="/admin/cataloghi" className="hover:underline">
              Cataloghi
            </a>
            <span>Â·</span>
            <a href="/admin/agenti" className="hover:underline">
              Agent Health
            </a>
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}
