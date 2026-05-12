import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Sparkles, BrainCircuit, GraduationCap, Zap } from "lucide-react";

function AnimatedCounter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCount(c => {
      if (c >= end) { clearInterval(t); return end; }
      return c + 1;
    }), 40);
    return () => clearInterval(t);
  }, [end]);
  return <>{count}{suffix}</>;
}

export default function PremiumSuccess() {
  const { t } = useTranslation();

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-50">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute animate-float-up"
            style={{
              left: `${Math.random() * 100}%`,
              bottom: "-10px",
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
              fontSize: `${14 + Math.random() * 16}px`,
              opacity: 0.7,
            }}
          >
            {["✦", "★", "✨", "💫", "⭐"][i % 5]}
          </div>
        ))}
      </div>

      <div className="container max-w-lg mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[80vh] text-center relative">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-primary uppercase tracking-wider">{t("premiumSuccess.badge")}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">
          {t("premiumSuccess.activated")}
        </h1>
        <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
          Ecco cosa puoi fare adesso:
        </p>

        <div className="grid grid-cols-3 gap-4 mb-10 w-full max-w-sm mx-auto">
          {[
            { icon: BrainCircuit, label: "Analisi completa", value: 1 },
            { icon: GraduationCap, label: "Percorsi formativi", value: 12 },
            { icon: Zap, label: "Tool AI sbloccati", value: 8 },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl bg-primary/5 border border-primary/10 p-3 text-center">
              <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-xl font-bold text-foreground"><AnimatedCounter end={value} /></div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center flex-wrap">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href="/dashboard">
              <BrainCircuit className="w-4 h-4 mr-2" />Sblocca analisi completa
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-6">
            <Link href="/settori">
              <GraduationCap className="w-4 h-4 mr-2" />Scopri percorsi formativi
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-6">
            <Link href="/coach">
              <Zap className="w-4 h-4 mr-2" />Inizia colloquio AI
            </Link>
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.7; }
          100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
        }
        .animate-float-up { animation: float-up linear forwards; }
      `}</style>
    </>
  );
}
