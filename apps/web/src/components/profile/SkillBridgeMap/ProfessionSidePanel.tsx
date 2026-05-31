import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, Check, MessageCircle, Sparkles } from "lucide-react";
import type { SkillBridgeProfession } from "./types";

export function ProfessionSidePanel({
  profession,
  userSkills,
  onAskWendy,
}: {
  profession: SkillBridgeProfession | null;
  userSkills: string[];
  onAskWendy: (prompt: string) => void;
}) {
  if (!profession) {
    return (
      <aside className="flex min-h-[320px] flex-col justify-center gap-3 border-t bg-muted/20 p-5 lg:border-l lg:border-t-0">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-base font-semibold text-foreground">Scegli un nodo</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Apri un ruolo per vedere cosa possiedi gia, quali skill mancano e quanto piccolo puo essere il prossimo salto.
          </p>
        </div>
      </aside>
    );
  }

  const explainPrompt = [
    `Perche ${profession.title} e vicina alle mie skill?`,
    `Skill che possiedo: ${profession.overlapSkills.join(", ") || userSkills.join(", ")}.`,
    `Skill mancanti: ${profession.missingSkills.join(", ") || "nessuna skill critica"}.`,
    `Contesto: professionId=${profession.id}, settore=${profession.sector}, stipendio=${profession.salaryRange}.`,
  ].join("\n");

  return (
    <aside className="space-y-5 border-t bg-muted/20 p-5 lg:border-l lg:border-t-0">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-foreground">{profession.title}</h3>
            <p className="text-sm text-muted-foreground">{profession.sector}</p>
          </div>
          <Badge variant="outline">Anello {profession.ring}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Match" value={`${profession.overlapPercent}%`} />
          <Metric label="Tempo stimato" value={`${profession.learnTimeWeeks ?? profession.missingSkills.length * 4} sett.`} />
        </div>
      </div>

      <Separator />

      <SkillList title="Skill possedute" empty="Nessuna sovrapposizione forte ancora." skills={profession.overlapSkills} owned />
      <SkillList title="Skill da colmare" empty="Sei gia molto vicino." skills={profession.missingSkills} />

      <div className="space-y-2">
        <Button type="button" className="w-full justify-start" onClick={() => onAskWendy(explainPrompt)}>
          <MessageCircle className="h-4 w-4" />
          Chiedi a Wendy
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={() => onAskWendy(`Qual e il salto piu piccolo che posso fare in 6 mesi verso ${profession.title}?`)}
        >
          <ArrowUpRight className="h-4 w-4" />
          Salto in 6 mesi
        </Button>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SkillList({
  title,
  empty,
  skills,
  owned = false,
}: {
  title: string;
  empty: string;
  skills: string[];
  owned?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {skills.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {skills.slice(0, 10).map((skill) => (
            <Badge key={skill} variant={owned ? "secondary" : "outline"} className="gap-1">
              {owned ? <Check className="h-3 w-3" /> : null}
              {skill}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

