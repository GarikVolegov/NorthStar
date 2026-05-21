import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { createCatalogItem, updateCatalogItem } from "./api";
import { ArrayField } from "./shared";
import type { EducationPath } from "./types";

type EducationPayload = {
  path: string;
  type: string;
  duration: string;
  cost: string;
  steps: string[];
  careerOutcomes: string[];
  sectorFit: string[];
};

export function EducationForm({
  initial,
  adminKey,
  onSaved,
  onCancel,
}: {
  initial?: EducationPath;
  adminKey: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [path, setPath] = useState(initial?.path ?? "");
  const [type, setType] = useState(initial?.type ?? "universitario");
  const [duration, setDuration] = useState(initial?.duration ?? "3 anni");
  const [cost, setCost] = useState(initial?.cost ?? "Gratuito");
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? []);
  const [careerOutcomes, setCareerOutcomes] = useState<string[]>(
    initial?.careerOutcomes ?? [],
  );
  const [sectorFit, setSectorFit] = useState<string[]>(
    initial?.sectorFit ?? [],
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload: EducationPayload = {
        path,
        type,
        duration,
        cost,
        steps,
        careerOutcomes,
        sectorFit,
      };
      if (initial)
        await updateCatalogItem(
          "education-paths",
          initial.id,
          adminKey,
          payload,
        );
      else await createCatalogItem("education-paths", adminKey, payload);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-2 border-primary/30">
      <CardContent className="space-y-3 pt-4">
        <Field label="Nome percorso" value={path} onChange={setPath} />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Tipo
            </label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="universitario">Universitario</option>
              <option value="professionale">Professionale</option>
              <option value="online">Online</option>
              <option value="bootcamp">Bootcamp</option>
            </select>
          </div>
          <Field label="Durata" value={duration} onChange={setDuration} />
          <Field label="Costo" value={cost} onChange={setCost} />
        </div>
        <ArrayField label="Step" value={steps} onChange={setSteps} />
        <ArrayField
          label="Sbocchi"
          value={careerOutcomes}
          onChange={setCareerOutcomes}
        />
        <ArrayField
          label="Aree compatibili"
          value={sectorFit}
          onChange={setSectorFit}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={saving || !path.trim()}
          >
            {saving ? (
              <Loader2 size={13} className="mr-1 animate-spin" />
            ) : (
              <Save size={13} className="mr-1" />
            )}
            {initial ? "Aggiorna" : "Crea"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Annulla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
    </div>
  );
}
