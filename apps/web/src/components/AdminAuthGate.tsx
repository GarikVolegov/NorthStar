/**
 * AdminAuthGate — Gate di autenticazione admin unificato.
 *
 * Mostra il login screen se non autenticati, altrimenti renderizza i children.
 * Usato come wrapper per tutte le pagine admin.
 */

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ShieldAlert } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface Props {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AdminAuthGate({ children, title, description }: Props) {
  const { key, isAuthenticated, authError, login, logout, setAuthError } = useAdminAuth();
  const [inputKey, setInputKey] = useState("");

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl border bg-card p-8 shadow-sm">
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <ShieldAlert className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-xl font-serif font-bold text-foreground">
                {title ?? "Accesso Admin"}
              </h1>
              <p className="text-sm text-muted-foreground text-center mt-1">
                {description ?? "Inserisci la chiave segreta per accedere al pannello di controllo"}
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = inputKey.trim();
                if (trimmed) login(trimmed);
              }}
              className="space-y-4"
            >
              <Input
                type="password"
                placeholder="Chiave admin…"
                value={inputKey}
                onChange={(e) => { setInputKey(e.target.value); setAuthError(false); }}
                className="rounded-xl"
                autoFocus
              />
              {authError && (
                <p className="text-sm text-destructive text-center">Chiave non valida. Riprova.</p>
              )}
              <Button type="submit" className="w-full rounded-full" disabled={!inputKey.trim()}>
                Accedi
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated: render children with a hidden top-bar logout
  return (
    <>
      {children}
      {/* Floating logout — accessible from any admin page */}
      <button
        onClick={logout}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors border shadow-sm"
        title="Disconnetti admin"
      >
        <Shield size={12} />
        Esci
      </button>
    </>
  );
}
