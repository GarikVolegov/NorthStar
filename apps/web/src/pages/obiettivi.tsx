import { usePageMeta } from "@/lib/seo";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";

export default function ObjectivesPage() {
  usePageMeta({
    title: "Obiettivi | Fondazione NorthStar",
    description: "Gli obiettivi ora sono raccolti nel diario personale.",
  });
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/diario?tab=objectives", { replace: true });
  }, [navigate]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="rounded-lg border bg-card p-5">
        <p className="text-xs font-semibold uppercase text-primary">Redirect</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Gli obiettivi ora vivono nel diario.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stiamo aprendo la sezione Obiettivi del tuo diario personale.
        </p>
        <Link className="mt-4 inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-semibold text-foreground hover:bg-muted" href="/diario?tab=objectives">
          Apri obiettivi nel diario
        </Link>
      </section>
    </main>
  );
}
