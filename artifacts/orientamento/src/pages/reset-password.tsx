import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Star, CheckCircle2, AlertTriangle } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

export default function ResetPassword() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4 opacity-80" />
        <h1 className="text-2xl font-serif font-bold mb-2">Link non valido</h1>
        <p className="text-muted-foreground mb-6">Il link per il reset della password non è valido o è già stato utilizzato.</p>
        <Button onClick={() => setLocation("/")}>Torna alla home</Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-serif font-bold mb-2">Password reimpostata!</h1>
        <p className="text-muted-foreground mb-6">Ora puoi accedere con la tua nuova password.</p>
        <Button onClick={() => setLocation("/")} className="rounded-full px-8">
          Vai al login
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore durante il reset");
      } else {
        setDone(true);
      }
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <Star className="h-5 w-5 text-primary fill-primary" />
          <span className="font-serif font-bold text-lg text-primary">NorthStar</span>
        </div>

        <h1 className="text-2xl font-serif font-bold mb-1">Nuova password</h1>
        <p className="text-muted-foreground text-sm mb-6">Scegli una nuova password per il tuo account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nuova password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Min. 6 caratteri"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Conferma password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Ripeti la nuova password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={confirmPassword && newPassword !== confirmPassword ? "border-destructive" : ""}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">Le password non coincidono</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

          <Button
            type="submit"
            className="w-full rounded-full font-medium"
            disabled={loading || (!!confirmPassword && newPassword !== confirmPassword)}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Reimposta password
          </Button>
        </form>
      </div>
    </div>
  );
}
