import { Link } from "wouter";
import { Star } from "lucide-react";

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={() => window.scrollTo({ top: 0, behavior: "instant" })}
      className="hover:text-primary transition-colors"
    >
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="border-t bg-card py-10 md:py-16">
      <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex flex-col items-start gap-4 max-w-sm">
          <Link
            href="/"
            onClick={() => window.scrollTo({ top: 0, behavior: "instant" })}
            className="flex items-center space-x-2"
          >
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
              <li><FooterLink href="/test">Il Test RIASEC</FooterLink></li>
              <li><FooterLink href="/settori">Esplora settori</FooterLink></li>
              <li><FooterLink href="/crescita">Crescita Personale</FooterLink></li>
              <li><FooterLink href="/news">News settoriali</FooterLink></li>
              <li><FooterLink href="/premium">Piano Premium</FooterLink></li>
              <li><FooterLink href="/contatti">Contatti</FooterLink></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Prodotto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><FooterLink href="/chi-siamo">Chi siamo</FooterLink></li>
              <li><FooterLink href="/come-funziona">Come funziona</FooterLink></li>
              <li><FooterLink href="/affiliazione">Affiliazione</FooterLink></li>
              <li><FooterLink href="/privacy-policy">Privacy Policy</FooterLink></li>
              <li><FooterLink href="/termini-di-servizio">Termini di servizio</FooterLink></li>
              <li><FooterLink href="/sitemap">Mappa del sito</FooterLink></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 mt-10 pt-6 border-t text-sm text-muted-foreground flex flex-wrap justify-between gap-3">
        <p>© {new Date().getFullYear()} NorthStar. Tutti i diritti riservati.</p>
        <div className="flex items-center gap-4">
          <FooterLink href="/privacy-policy">Privacy</FooterLink>
          <FooterLink href="/termini-di-servizio">Termini</FooterLink>
          <FooterLink href="/chi-siamo">Chi siamo</FooterLink>
        </div>
      </div>
    </footer>
  );
}
