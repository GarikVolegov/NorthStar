import { getJson, patchJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Loader2, Lock, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export function PrivacyCard({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const [isPublic, setIsPublic] = useState<boolean | null>(null);

  useQuery({
    queryKey: ["privacy-status", userId],
    queryFn: async () => {
      const d = await getJson<{ isPublic?: boolean }>(
        `${BASE}api/users/${userId}/public`,
      );
      setIsPublic(d.isPublic ?? false);
      return d.isPublic ?? false;
    },
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      return patchJson<{ isPublic: boolean }>(
        `${BASE}api/users/${userId}/privacy`,
        { isPublic: newValue },
      );
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
          {current ? (
            <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium">
            {current ? "Profilo pubblico" : "Profilo privato"}
          </span>
        </div>
        <button
          onClick={() => mutation.mutate(!current)}
          disabled={isPublic === null || mutation.isPending}
          className={cn(
            "relative w-11 h-6 rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            current ? "bg-emerald-500" : "bg-muted-foreground/30",
            (isPublic === null || mutation.isPending) &&
              "opacity-50 cursor-not-allowed",
          )}
          aria-label="Toggle visibilità profilo"
        >
          <span
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
              current ? "translate-x-[22px]" : "translate-x-1",
            )}
          />
          {mutation.isPending && (
            <Loader2 className="absolute inset-0 m-auto w-3.5 h-3.5 animate-spin text-white" />
          )}
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {current
          ? "Il tuo profilo è visibile agli altri utenti. Possono trovarti tramite la ricerca e inviarti richieste di amicizia."
          : "Il tuo profilo è privato. Solo i tuoi amici attuali possono vederti; non appari nella ricerca."}
      </p>
      {current && (
        <Link
          href="/amici"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Users className="w-3 h-3" /> Gestisci amici
        </Link>
      )}
    </div>
  );
}
