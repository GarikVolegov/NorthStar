import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { createCatalogItem, updateCatalogItem } from "./api";
import type { Sector } from "./types";

type SectorPayload = {
  name: string;
  description: string;
  icon: string;
  color: string;
  automationRisk: string;
  trend: string;
  growthRate: number;
  avgSalaryMin: number;
  avgSalaryMax: number;
};

export function SectorForm({
  initial,
  adminKey,
  onSaved,
  onCancel,
}: {
  initial?: Sector;
  adminKey: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "briefcase");
  const color = initial?.color ?? "hsl(var(--chart-4))";
  const [automationRisk, setAutomationRisk] = useState(
    initial?.automationRisk ?? "medium",
  );
  const [trend, setTrend] = useState(initial?.trend ?? "stable");
  const [growthRate, setGrowthRate] = useState(
    String(initial?.growthRate ?? 5),
  );
  const [salaryMin, setSalaryMin] = useState(
    String(initial?.avgSalaryMin ?? 25000),
  );
  const [salaryMax, setSalaryMax] = useState(
    String(initial?.avgSalaryMax ?? 50000),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload: SectorPayload = {
        name,
        description,
        icon,
        color,
        automationRisk,
        trend,
        growthRate: Number(growthRate),
        avgSalaryMin: Number(salaryMin),
        avgSalaryMax: Number(salaryMax),
      };
      if (initial)
        await updateCatalogItem("sectors", initial.id, adminKey, payload);
      else await createCatalogItem("sectors", adminKey, payload);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-2 border-primary/30">
      <CardContent className="space-y-3 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" value={name} onChange={setName} />
          <Field label="Icona" value={icon} onChange={setIcon} />
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
        <div className="grid grid-cols-3 gap-3">
          <SelectField
            label="Rischio automazione"
            value={automationRisk}
            onChange={setAutomationRisk}
            options={[
              ["low", "Basso"],
              ["medium", "Medio"],
              ["high", "Alto"],
            ]}
          />
          <SelectField
            label="Trend"
            value={trend}
            onChange={setTrend}
            options={[
              ["declining", "In calo"],
              ["stable", "Stabile"],
              ["growing", "In crescita"],
              ["booming", "Boom"],
            ]}
          />
          <Field
            label="Crescita %"
            value={growthRate}
            onChange={setGrowthRate}
            type="number"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Stipendio min (EUR)"
            value={salaryMin}
            onChange={setSalaryMin}
            type="number"
          />
          <Field
            label="Stipendio max (EUR)"
            value={salaryMax}
            onChange={setSalaryMax}
            type="number"
          />
        </div>
        <FormActions
          saving={saving}
          disabled={!name.trim()}
          initial={Boolean(initial)}
          onSave={() => void save()}
          onCancel={onCancel}
        />
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </div>
  );
}

function FormActions({
  saving,
  disabled,
  initial,
  onSave,
  onCancel,
}: {
  saving: boolean;
  disabled: boolean;
  initial: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={onSave} disabled={saving || disabled}>
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
  );
}
