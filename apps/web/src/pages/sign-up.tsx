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
import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

export default function SignUpPage() {
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
            <span className="text-xs text-muted-foreground leading-none">Il tuo orientamento professionale</span>
          </div>
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-sm text-muted-foreground text-center">
            Gratis — inizia il tuo percorso oggi
          </p>
        </div>
      </div>

      {/* Clerk SignUp component */}
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
      />

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground text-center">
        Hai già un account?{" "}
        <Link href="/sign-in" className="text-primary hover:underline font-semibold">
          Accedi
        </Link>
      </p>
    </div>
  );
}
