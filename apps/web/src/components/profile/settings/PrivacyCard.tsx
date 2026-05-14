import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Lock, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

export function PrivacyCard({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const [isPublic, setIsPublic] = useState<boolean | null>(null);

  useQuery({
    queryKey: ["privacy-status", userId],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/users/${userId}/public?viewerId=${userId}`);
      if (!res.ok) throw new Error("Errore");
      const d = await res.json();
      setIsPublic(d.isPublic ?? false);
      return d.isPublic as boolean;
    },
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const res = await fetch(`${BASE}api/users/${userId}/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newValue }),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: (data) => {
      setIsPublic(data.isPublic);
      queryClient.invalidateQueries({ queryKey: ["privacy-status", userId] });
    },
  });

  const current = isPublic ?? false;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {current ? <Globe className="w-4 h-4 text-emerald-500 shrink-0" /> : <Lock className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium">{current ? "Profilo pubblico" : "Profilo privato"}</span>
        </div>
        <button
          onClick={() => mutation.mutate(!current)}
          disabled={isPublic === null || mutation.isPending}
          className={cn(
            "relative w-11 h-6 rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            current ? "bg-emerald-500" : "bg-muted-foreground/30",
            (isPublic === null || mutation.isPending) && "opacity-50 cursor-not-allowed",
          )}
          aria-label="Toggle visibilità profilo"
        >
          <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200", current ? "translate-x-[22px]" : "translate-x-1")} />
          {mutation.isPending && <Loader2 className="absolute inset-0 m-auto w-3.5 h-3.5 animate-spin text-white" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {current
          ? "Il tuo profilo è visibile agli altri utenti. Possono trovarti tramite la ricerca e inviarti richieste di amicizia."
          : "Il tuo profilo è privato. Solo i tuoi amici attuali possono vederti; non appari nella ricerca."}
      </p>
      {current && (
        <Link href="/amici" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
          <Users className="w-3 h-3" /> Gestisci amici
        </Link>
      )}
    </div>
  );
}
