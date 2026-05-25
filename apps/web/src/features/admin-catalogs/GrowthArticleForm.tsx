import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { createCatalogItem, updateCatalogItem } from "./api";
import type { GrowthArticle } from "./types";

type GrowthArticlePayload = {
  title: string;
  category: string;
  description: string;
  difficulty: string;
  status: string;
  readTimeMinutes: number;
  content: string;
};

export function GrowthArticleForm({
  initial,
  adminKey,
  onSaved,
  onCancel,
}: {
  initial?: GrowthArticle;
  adminKey: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "generale");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "base");
  const [status, setStatus] = useState(initial?.status ?? "published");
  const [readTime, setReadTime] = useState(
    String(initial?.readTimeMinutes ?? 3),
  );
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload: GrowthArticlePayload = {
        title,
        category,
        description,
        difficulty,
        status,
        readTimeMinutes: Number(readTime),
        content,
      };
      if (initial)
        await updateCatalogItem(
          "growth-articles",
          initial.id,
          adminKey,
          payload,
        );
      else await createCatalogItem("growth-articles", adminKey, payload);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-2 border-primary/30">
      <CardContent className="space-y-3 pt-4">
        <Field label="Titolo" value={title} onChange={setTitle} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Categoria" value={category} onChange={setCategory} />
          <SelectField
            label="Difficolta"
            value={difficulty}
            onChange={setDifficulty}
            options={[
              ["base", "Base"],
              ["intermedio", "Intermedio"],
              ["avanzato", "Avanzato"],
            ]}
          />
          <SelectField
            label="Stato"
            value={status}
            onChange={setStatus}
            options={[
              ["published", "Pubblicato"],
              ["pending", "In attesa"],
              ["rejected", "Scartato"],
            ]}
          />
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
        <Field
          label="Minuti lettura"
          value={readTime}
          onChange={setReadTime}
          type="number"
        />
        {!initial && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Contenuto (Markdown)
            </label>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="mt-1 font-mono text-xs"
              rows={6}
            />
          </div>
        )}
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
