import { Link } from "wouter";
import { Star } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-card py-10 md:py-16">
      <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex flex-col items-start gap-4 max-w-sm">
          <Link href="/" className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-primary fill-primary" />
            <span className="font-serif font-bold text-xl tracking-tight text-primary">
              NorthStar
            </span>
          </Link>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Una bussola per il tuo futuro. Non ti diciamo dove andare,
            ti mostriamo le possibilità per scegliere la tua strada con consapevolezza.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 w-full md:w-auto">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Risorse</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/test" className="hover:text-primary transition-colors">
                  Il Test RIASEC
                </Link>
              </li>
              <li>
                <Link href="/news" className="hover:text-primary transition-colors">
                  News settoriali
                </Link>
              </li>
              <li>
                <Link href="/premium" className="hover:text-primary transition-colors">
                  Piano Premium
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Prodotto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/chi-siamo" className="hover:text-primary transition-colors">
                  Chi siamo
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/termini-di-servizio" className="hover:text-primary transition-colors">
                  Termini di servizio
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 mt-10 pt-6 border-t text-sm text-muted-foreground flex flex-wrap justify-between gap-3">
        <p>© {new Date().getFullYear()} NorthStar. Tutti i diritti riservati.</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy-policy" className="hover:text-primary transition-colors">Privacy</Link>
          <Link href="/termini-di-servizio" className="hover:text-primary transition-colors">Termini</Link>
          <Link href="/chi-siamo" className="hover:text-primary transition-colors">Chi siamo</Link>
        </div>
      </div>
    </footer>
  );
}
