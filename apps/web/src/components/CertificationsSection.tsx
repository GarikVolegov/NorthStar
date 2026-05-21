import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteJson, getJson, postJson } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BadgeCheck,
  ChevronUp,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

interface Certification {
  id: number;
  name: string;
  issuer: string;
  issuedDate: string | null;
  expiryDate: string | null;
  credentialUrl: string | null;
  credentialId: string | null;
  sector: string | null;
  skills: string[];
  status: string;
  verified: boolean;
  createdAt: string;
}

function CertForm({ onAdd }: { onAdd: () => void }) {
  const [form, setForm] = useState({
    name: "",
    issuer: "",
    issuedDate: "",
    credentialUrl: "",
    sector: "",
    skills: "",
  });
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      await postJson<unknown>("/api/certifications", {
        ...form,
        skills: form.skills
          ? form.skills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        issuedDate: form.issuedDate || undefined,
        credentialUrl: form.credentialUrl || undefined,
        sector: form.sector || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certifications"] });
      setForm({
        name: "",
        issuer: "",
        issuedDate: "",
        credentialUrl: "",
        sector: "",
        skills: "",
      });
      onAdd();
    },
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5 mt-4 space-y-4">
      <h4 className="font-semibold text-sm text-foreground">
        Nuova certificazione
      </h4>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Nome certificazione *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="es. Google UX Design"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Ente emittente *</Label>
          <Input
            value={form.issuer}
            onChange={(e) => setForm({ ...form, issuer: e.target.value })}
            placeholder="es. Coursera / Google"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Data conseguimento</Label>
          <Input
            type="date"
            value={form.issuedDate}
            onChange={(e) => setForm({ ...form, issuedDate: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Settore</Label>
          <Input
            value={form.sector}
            onChange={(e) => setForm({ ...form, sector: e.target.value })}
            placeholder="es. Design, Tech, Marketing"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">URL credenziale</Label>
          <Input
            value={form.credentialUrl}
            onChange={(e) =>
              setForm({ ...form, credentialUrl: e.target.value })
            }
            placeholder="https://..."
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">
            Skills (separate da virgola)
          </Label>
          <Input
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            placeholder="Figma, Ricerca utenti, Prototipo"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="rounded-full text-xs px-4"
          disabled={!form.name || !form.issuer || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? "Salvataggio…" : "Aggiungi certificazione"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-xs"
          onClick={onAdd}
        >
          Annulla
        </Button>
      </div>
    </div>
  );
}

export function CertificationsSection({ userId }: { userId: number }) {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: certs = [], isLoading } = useQuery<Certification[]>({
    queryKey: ["certifications"],
    queryFn: () => getJson<Certification[]>("/api/certifications"),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await deleteJson(`/api/certifications/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["certifications"] }),
  });

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("it-IT", {
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          Certificazioni & Corsi
          {certs.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
              {certs.length}
            </span>
          )}
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full gap-1 text-xs"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          {showForm ? "Chiudi" : "Aggiungi"}
        </Button>
      </div>

      {showForm && <CertForm onAdd={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="space-y-3 mt-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-card border border-border rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : certs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm bg-card border border-dashed border-border rounded-xl">
          <Award className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Nessuna certificazione aggiunta ancora.</p>
          <p className="text-xs mt-1">
            Aggiungi corsi, certificati e attestati per arricchire il tuo
            profilo.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mt-3">
          {certs.map((cert) => (
            <div
              key={cert.id}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 group hover:border-primary/20 transition-all"
            >
              <div className="mt-0.5 p-2 rounded-lg bg-primary/10 shrink-0">
                <BadgeCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-sm text-foreground leading-tight">
                      {cert.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cert.issuer}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {cert.credentialUrl && (
                      <a
                        href={cert.credentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => deleteMut.mutate(cert.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {cert.issuedDate && (
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {fmt(cert.issuedDate)}
                    </span>
                  )}
                  {cert.sector && (
                    <span className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {cert.sector}
                    </span>
                  )}
                  {cert.skills.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="text-[11px] text-muted-foreground bg-white/5 border border-border px-2 py-0.5 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                  {cert.skills.length > 3 && (
                    <span className="text-[11px] text-muted-foreground">
                      +{cert.skills.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
