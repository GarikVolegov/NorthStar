import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-background">
      <div className="text-8xl font-black text-primary/10 select-none mb-4">404</div>
      <h1 className="text-2xl font-bold mb-2 text-foreground">{t("notFound.title")}</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        La pagina che cerchi non esiste o è stata spostata.
      </p>
      <div className="flex gap-3">
        <Button asChild><Link href="/dashboard">Vai alla dashboard</Link></Button>
        <Button variant="ghost" asChild><Link href="/">Home</Link></Button>
      </div>
    </div>
  );
}
