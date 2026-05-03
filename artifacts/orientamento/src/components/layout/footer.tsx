import { Link } from "wouter";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

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
            {t("footer.tagline")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 w-full md:w-auto">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">{t("footer.resources")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><FooterLink href="/test">{t("footer.links.test")}</FooterLink></li>
              <li><FooterLink href="/settori">{t("footer.links.sectors")}</FooterLink></li>
              <li><FooterLink href="/crescita">{t("footer.links.growth")}</FooterLink></li>
              <li><FooterLink href="/news">{t("footer.links.news")}</FooterLink></li>
              <li><FooterLink href="/premium">{t("footer.links.premium")}</FooterLink></li>
              <li><FooterLink href="/contatti">{t("footer.links.contact")}</FooterLink></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">{t("footer.product")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
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

      <div className="container mx-auto px-4 md:px-6 mt-10 pt-6 border-t text-sm text-muted-foreground flex flex-wrap justify-between gap-3">
        <p>© {new Date().getFullYear()} NorthStar. {t("footer.rights")}</p>
        <div className="flex items-center gap-4">
          <FooterLink href="/privacy-policy">{t("footer.privacy")}</FooterLink>
          <FooterLink href="/termini-di-servizio">{t("footer.terms")}</FooterLink>
          <FooterLink href="/chi-siamo">{t("footer.about")}</FooterLink>
        </div>
      </div>
    </footer>
  );
}
