import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Star } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTab?: "login" | "register";
}

export function LoginDialog({ open, onOpenChange, defaultTab = "login" }: LoginDialogProps) {
  const { login } = useAuth();
  const [tab, setTab] = useState<"login" | "register">(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  function reset() {
    setError(null);
    setLoading(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore durante il login");
      } else {
        login(data);
        onOpenChange(false);
        reset();
      }
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore durante la registrazione");
      } else {
        login(data);
        onOpenChange(false);
        reset();
      }
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-5 w-5 text-primary fill-primary" />
            <span className="font-serif font-bold text-lg text-primary">NorthStar</span>
          </div>
          <DialogTitle className="text-xl font-serif">
            {tab === "login" ? "Bentornato" : "Crea il tuo account"}
          </DialogTitle>
          <DialogDescription>
            {tab === "login"
              ? "Accedi per ritrovare il tuo percorso e i tuoi risultati."
              : "Registrati per salvare il tuo percorso e accedere ai contenuti premium."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex rounded-xl bg-muted p-1 mb-4">
          <button
            onClick={() => { setTab("login"); setError(null); }}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === "login" ? "bg-white shadow text-foreground" : "text-muted-foreground"
            }`}
          >
            Accedi
          </button>
          <button
            onClick={() => { setTab("register"); setError(null); }}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === "register" ? "bg-white shadow text-foreground" : "text-muted-foreground"
            }`}
          >
            Registrati
          </button>
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="la-tua@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full rounded-full font-medium" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Accedi
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Non hai un account?{" "}
              <button type="button" onClick={() => { setTab("register"); setError(null); }} className="text-primary hover:underline font-medium">
                Registrati
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Nome</Label>
              <Input
                id="reg-name"
                placeholder="Il tuo nome"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="la-tua@email.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-password">Password</Label>
              <Input
                id="reg-password"
                type="password"
                placeholder="Min. 6 caratteri"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full rounded-full font-medium" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crea account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Hai già un account?{" "}
              <button type="button" onClick={() => { setTab("login"); setError(null); }} className="text-primary hover:underline font-medium">
                Accedi
              </button>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
