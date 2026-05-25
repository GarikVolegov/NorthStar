import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { createCatalogItem, updateCatalogItem } from "./api";
import type { Profession } from "./types";

type ProfessionPayload = {
  title: string;
  sector: string;
  description: string;
  salaryRange: string;
  growthOutlook: string;
};

export function ProfessionForm({
  initial,
  adminKey,
  onSaved,
  onCancel,
}: {
  initial?: Profession;
  adminKey: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sector, setSector] = useState(initial?.sector ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [salaryRange, setSalaryRange] = useState(
    initial?.salaryRange ?? "25.000-45.000 EUR",
  );
  const [growthOutlook, setGrowthOutlook] = useState(
    initial?.growthOutlook ?? "stable",
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload: ProfessionPayload = {
        title,
        sector,
        description,
        salaryRange,
        growthOutlook,
      };
      if (initial)
        await updateCatalogItem("professions", initial.id, adminKey, payload);
      else await createCatalogItem("professions", adminKey, payload);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-2 border-primary/30">
      <CardContent className="space-y-3 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Titolo" value={title} onChange={setTitle} />
          <Field label="Settore" value={sector} onChange={setSector} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Descrizione
          </label>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Range stipendio"
            value={salaryRange}
            onChange={setSalaryRange}
          />
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Outlook
            </label>
            <select
              value={growthOutlook}
              onChange={(event) => setGrowthOutlook(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="declining">In calo</option>
              <option value="stable">Stabile</option>
              <option value="growing">In crescita</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={saving || !title.trim()}
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
