import { useTranslation } from "react-i18next";
import { Link } from "wouter";

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={() => window.scrollTo({ top: 0, behavior: "instant" })}
      className="text-muted-foreground hover:text-foreground transition-colors duration-200"
    >
      {children}
    </Link>
  );
}

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border bg-card py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start gap-10 md:gap-16">

          {/* Brand */}
          <div className="flex flex-col items-start gap-4 max-w-xs">
            <Link
              href="/"
              onClick={() => window.scrollTo({ top: 0, behavior: "instant" })}
              className="flex items-center gap-2.5"
            >
              <img src="/logo.svg" alt="NorthStar" className="h-8 w-8 rounded-full object-cover" />
              <span className="font-bold text-lg tracking-tight text-foreground">NorthStar</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("footer.tagline")}
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground">Piattaforma attiva</span>
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 w-full md:w-auto">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground/60">{t("footer.resources")}</h4>
              <ul className="space-y-2.5 text-sm">
                <li><FooterLink href="/test">{t("footer.links.test")}</FooterLink></li>
                <li><FooterLink href="/settori">{t("footer.links.sectors")}</FooterLink></li>
                <li><FooterLink href="/crescita">{t("footer.links.growth")}</FooterLink></li>
                <li><FooterLink href="/news">{t("footer.links.news")}</FooterLink></li>
                <li><FooterLink href="/premium">{t("footer.links.premium")}</FooterLink></li>
                <li><FooterLink href="/contatti">{t("footer.links.contact")}</FooterLink></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground/60">{t("footer.product")}</h4>
              <ul className="space-y-2.5 text-sm">
                <li><FooterLink href="/chi-siamo">{t("footer.links.about")}</FooterLink></li>
                <li><FooterLink href="/come-funziona">{t("footer.links.howItWorks")}</FooterLink></li>
                <li><FooterLink href="/affiliazione">{t("footer.links.affiliation")}</FooterLink></li>
                <li><FooterLink href="/privacy-policy">{t("footer.links.privacy")}</FooterLink></li>
                <li><FooterLink href="/termini-di-servizio">{t("footer.links.terms")}</FooterLink></li>
                <li><FooterLink href="/sitemap">{t("footer.links.sitemap")}</FooterLink></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} NorthStar. {t("footer.rights")}</p>
          <div className="flex items-center gap-4">
            <FooterLink href="/privacy-policy">{t("footer.privacy")}</FooterLink>
            <FooterLink href="/termini-di-servizio">{t("footer.terms")}</FooterLink>
            <FooterLink href="/chi-siamo">{t("footer.about")}</FooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
