import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import type { SkillBridgeFiltersState } from "./types";

const EMPTY_FILTERS: SkillBridgeFiltersState = {
  sectorId: "",
  minSalary: "",
  workMode: "",
  city: "",
};

export function BridgeFilters({
  value,
  onChange,
}: {
  value: SkillBridgeFiltersState;
  onChange: (value: SkillBridgeFiltersState) => void;
}) {
  return (
    <div className="grid gap-3 border-b bg-muted/20 p-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
      <Field label="Settore">
        <Input
          inputMode="numeric"
          placeholder="ID settore"
          value={value.sectorId}
          onChange={(event) => onChange({ ...value, sectorId: event.target.value })}
        />
      </Field>
      <Field label="Stipendio minimo">
        <Input
          inputMode="numeric"
          placeholder="30000"
          value={value.minSalary}
          onChange={(event) => onChange({ ...value, minSalary: event.target.value })}
        />
      </Field>
      <Field label="Modalita">
        <Select
          value={value.workMode || "all"}
          onValueChange={(workMode) => onChange({ ...value, workMode: workMode === "all" ? "" : workMode })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Qualsiasi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualsiasi</SelectItem>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="ibrido">Ibrido</SelectItem>
            <SelectItem value="freelance">Freelance</SelectItem>
            <SelectItem value="team">Team</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Citta">
        <Input
          placeholder="Milano"
          value={value.city}
          onChange={(event) => onChange({ ...value, city: event.target.value })}
        />
      </Field>
      <Button
        type="button"
        variant="outline"
        className="md:self-end"
        onClick={() => onChange(EMPTY_FILTERS)}
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
