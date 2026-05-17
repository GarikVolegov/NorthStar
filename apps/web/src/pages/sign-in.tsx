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
import { Link } from "wouter";
import { Compass } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background px-4 py-10">
      {/* Brand header */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center transition-all group-hover:bg-primary/20">
            <Compass className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="font-bold text-lg text-foreground leading-none block">NorthStar</span>
            <span className="text-xs text-muted-foreground leading-none">Il tuo orientamento professionale</span>
          </div>
        </Link>
        <p className="text-sm text-muted-foreground text-center max-w-xs mt-1">
          Accedi per continuare il tuo percorso di crescita
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
        Non hai un account?{" "}
        <Link href="/sign-up" className="text-primary hover:underline font-semibold">
          Inizia gratis
        </Link>
      </p>
    </div>
  );
}
