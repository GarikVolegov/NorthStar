import { Compass } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-card py-10 md:py-16">
      <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex flex-col items-start gap-4 max-w-sm">
          <div className="flex items-center space-x-2">
            <Compass className="h-6 w-6 text-primary" />
            <span className="font-serif font-bold text-xl tracking-tight text-primary">
              NorthStar
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Una bussola per il tuo futuro. Non ti diciamo dove andare, ti mostriamo le possibilità per scegliere la tua strada con consapevolezza.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 w-full md:w-auto">
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Risorse</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Il Test RIASEC</li>
              <li>Settori professionali</li>
              <li>Storie di successo</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Prodotto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Chi siamo</li>
              <li>Privacy Policy</li>
              <li>Termini di servizio</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 md:px-6 mt-10 pt-6 border-t text-sm text-muted-foreground flex justify-between">
        <p>© {new Date().getFullYear()} NorthStar. Tutti i diritti riservati.</p>
        <p>Progettato con cura.</p>
      </div>
    </footer>
  );
}
