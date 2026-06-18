/**
 * /bussola/blocco — Diagnostico del blocco.
 * Non tutti gli indecisi sono uguali: dare un nome al tipo di blocco instrada
 * l'esperienza e il tono. Imposta compass_profiles.block_type.
 */
import { useCompass, type CompassBlockType } from "@/features/compass/useCompass";
import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

const OPTIONS: { type: CompassBlockType; label: string; sub: string }[] = [
  { type: "too_many_interests", label: "Ho troppi interessi", sub: "Mi piacciono mille cose, non riesco a sceglierne una" },
  { type: "no_interests", label: "Niente mi accende", sub: "Non sento un richiamo verso niente in particolare" },
  { type: "fear_economic", label: "Ho paura economica", sub: "Temo di scegliere qualcosa che non mi dia da vivere" },
  { type: "external_pressure", label: "C'è pressione esterna", sub: "Qualcuno si aspetta che io faccia una cosa precisa" },
  { type: "fear_mediocrity", label: "Ho paura di essere mediocre", sub: "Temo di scegliere e poi non essere bravo" },
];

export default function BloccoPage() {
  const { diagnose } = useCompass();
  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState<CompassBlockType | null>(null);

  async function choose(type: CompassBlockType) {
    setSaving(type);
    await diagnose(type);
    setLocation(`${BASE}bussola`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-6">
      <header className="flex items-center gap-3">
        <HelpCircle className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Cosa ti blocca davvero?</h1>
          <p className="text-sm text-muted-foreground">Dare un nome all'indecisione è il primo passo per scioglierla.</p>
        </div>
      </header>

      <div className="space-y-3">
        {OPTIONS.map((o) => (
          <button
            key={o.type}
            disabled={saving !== null}
            onClick={() => choose(o.type)}
            className={`w-full rounded-xl border p-4 text-left transition hover:border-primary/50 disabled:opacity-60 ${
              saving === o.type ? "border-primary" : ""
            }`}
          >
            <span className="block font-medium">{o.label}</span>
            <span className="block text-sm text-muted-foreground">{o.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
