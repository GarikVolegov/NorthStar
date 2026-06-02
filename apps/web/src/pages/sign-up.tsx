/**
 * sign-up.tsx — Registrazione con Clerk.
 *
 * Sostituisce il vecchio register.tsx custom.
 * Il componente <SignUp> gestisce: email/password, Google OAuth,
 * verifica email, e raccolta profilo iniziale.
 *
 * Dopo il sign-up, Clerk chiama /api/auth/clerk-sync automaticamente
 * tramite AuthContext.tsx per sincronizzare l'utente nel DB NorthStar.
 */
import { SignUp } from "@clerk/react";
import { AppLogo } from "@/components/brand/AppLogo";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export default function SignUpPage() {
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
    key: "auth.signUp.subtitle",
    source: "Gratis - inizia il tuo percorso oggi",
    context: "Sign-up page subtitle",
  });
  const hasAccountLabel = useDynamicTranslation({
    locale,
    key: "auth.signUp.hasAccount",
    source: "Hai gia' un account?",
    context: "Sign-up footer prompt before the sign-in link",
  });
  const signInLabel = useDynamicTranslation({
    locale,
    key: "auth.signUp.signIn",
    source: "Accedi",
    context: "Sign-up footer link to sign in",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const referralCode = params.get("ref") ?? params.get("referralCode");
    if (!referralCode?.trim()) return;
    localStorage.setItem("referralCode", referralCode.trim());
    sessionStorage.setItem("referralCode", referralCode.trim());
  }, []);

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
        <div className="flex items-center gap-2 mt-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-sm text-muted-foreground text-center">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Clerk SignUp component */}
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
      />

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground text-center">
        {hasAccountLabel}{" "}
        <Link href="/sign-in" className="text-primary hover:underline font-semibold">
          {signInLabel}
        </Link>
      </p>
    </div>
  );
}

