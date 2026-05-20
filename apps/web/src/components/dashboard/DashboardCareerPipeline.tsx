import { ArrowRight, Briefcase, CheckCircle2, Eye, MessageSquare, Send } from "lucide-react";
import { Link } from "wouter";

const STAGES = [
  { key: "saved", label: "Salvate", icon: Eye },
  { key: "applied", label: "Inviate", icon: Send },
  { key: "interview", label: "Colloquio", icon: MessageSquare },
  { key: "offer", label: "Offerta", icon: CheckCircle2 },
];

export function DashboardCareerPipeline({
  applications,
}: {
  applications?: Record<string, number>;
}) {
  const stages = STAGES.map((s) => ({
    ...s,
    count: applications?.[s.key] ?? 0,
  }));
  const total = stages.reduce((a, s) => a + s.count, 0);

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <Briefcase className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Candidature</h3>
          <p className="text-xs text-muted-foreground">{total} candidature totali</p>
        </div>
        <Link href="/candidature" className="text-xs text-primary font-semibold hover:underline shrink-0">
          Gestisci <ArrowRight className="w-3 h-3 inline ml-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {stages.map((s) => (
          <div key={s.key} className="text-center p-3 rounded-xl bg-muted/50">
            <s.icon className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-lg font-bold text-foreground">{s.count}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
