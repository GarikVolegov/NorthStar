import { Compass } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";

export default function ChiSiamo() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/#chi-siamo", { replace: true });
    window.setTimeout(() => {
      document.getElementById("chi-siamo")?.scrollIntoView({ block: "start" });
    }, 0);
  }, [navigate]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <Compass className="h-3.5 w-3.5" />
          Chi siamo
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          La storia di NorthStar ora vive nella Home.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Stiamo aprendo la sezione dedicata a missione, metodo e valori.
        </p>
        <Link
          className="mt-4 inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          href="/#chi-siamo"
        >
          Apri Chi siamo
        </Link>
      </section>
    </main>
  );
}
