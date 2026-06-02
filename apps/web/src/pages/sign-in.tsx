/**
 * sign-in.tsx — Pagina di accesso con Clerk.
 *
 * Clerk usa questa pagina quando redirige qui dopo un tentativo di accesso
 * a una route protetta. Il componente <SignIn> di Clerk gestisce tutto il
 * flusso: email/password, Google, magic link, 2FA.
 *
 * Design: layout centrato con branding NorthStar sopra il form.
 * Il tema deep-navy è già configurato nel ClerkProvider (main.tsx).
 */
import { SignIn } from "@clerk/react";
import { AppLogo } from "@/components/brand/AppLogo";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export default function SignInPage() {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const brandTagline = useDynamicTranslation({
    locale,
    key: "auth.brandTagline",
    source: "Il tuo orientamento professionale",
    context: "Authentication page brand tagline",
  });
  const subtitle = useDynamicTranslation({
    locale,
    key: "auth.signIn.subtitle",
    source: "Accedi per continuare il tuo percorso di crescita",
    context: "Sign-in page subtitle",
  });
  const noAccountLabel = useDynamicTranslation({
    locale,
    key: "auth.signIn.noAccount",
    source: "Non hai un account?",
    context: "Sign-in footer prompt before the sign-up link",
  });
  const startFreeLabel = useDynamicTranslation({
    locale,
    key: "auth.signIn.startFree",
    source: "Inizia gratis",
    context: "Sign-in footer link to registration",
  });

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background px-4 py-10">
      {/* Brand header */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center transition-all group-hover:bg-primary/20">
            <AppLogo decorative className="h-8 w-8" />
          </div>
          <div>
            <span className="font-bold text-lg text-foreground leading-none block">NorthStar</span>
            <span className="text-xs text-muted-foreground leading-none">{brandTagline}</span>
          </div>
        </Link>
        <p className="text-sm text-muted-foreground text-center max-w-xs mt-1">
          {subtitle}
        </p>
      </div>

      {/* Clerk SignIn component — tema configurato in main.tsx */}
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
      />

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground text-center">
        {noAccountLabel}{" "}
        <Link href="/sign-up" className="text-primary hover:underline font-semibold">
          {startFreeLabel}
        </Link>
      </p>
    </div>
  );
}
