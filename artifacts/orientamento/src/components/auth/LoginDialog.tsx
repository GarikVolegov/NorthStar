import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Star, ArrowLeft, Mail, CheckCircle2, KeyRound } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          renderButton: (el: HTMLElement, cfg: object) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

type View = "login" | "register" | "verify" | "forgot" | "forgot-sent" | "reset-sent";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTab?: "login" | "register";
}

export function LoginDialog({ open, onOpenChange, defaultTab = "login" }: LoginDialogProps) {
  const { login } = useAuth();
  const [view, setView] = useState<View>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");

  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState(["", "", "", "", "", ""]);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [forgotEmail, setForgotEmail] = useState("");

  const googleBtnRef = useRef<HTMLDivElement>(null);

  function resetAll() {
    setError(null);
    setDevHint(null);
    setLoading(false);
    setGoogleLoading(false);
  }

  function goTo(v: View) {
    setError(null);
    setDevHint(null);
    setView(v);
  }

  useEffect(() => {
    if (open) setView(defaultTab);
  }, [open, defaultTab]);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/auth/google-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore con Google. Riprova.");
      } else {
        login(data);
        onOpenChange(false);
        resetAll();
      }
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setGoogleLoading(false);
    }
  }, [login, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    if ((view !== "login" && view !== "register")) return;

    const clientId = (window as any).__GOOGLE_CLIENT_ID__;
    const gsiReady = !!window.google?.accounts?.id;

    if (!clientId || !gsiReady || !googleBtnRef.current) return;

    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential: string }) => {
        handleGoogleCredential(response.credential);
      },
      auto_select: false,
    });

    window.google!.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline",
      size: "large",
      width: googleBtnRef.current.offsetWidth || 340,
      text: "continue_with",
      locale: "it",
      shape: "pill",
    });
  }, [open, view, handleGoogleCredential]);

  function handleCodeInput(idx: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...verifyCode];
    next[idx] = digit;
    setVerifyCode(next);
    if (digit && idx < 5) codeRefs.current[idx + 1]?.focus();
  }

  function handleCodeKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !verifyCode[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setVerifyCode(text.split(""));
      codeRefs.current[5]?.focus();
    }
    e.preventDefault();
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
        if (data.needsVerification) {
          setVerifyEmail(data.email ?? loginEmail);
          if (data.devCode) setDevHint(data.devCode);
          goTo("verify");
        } else {
          setError(data.error || "Errore durante il login");
        }
      } else {
        login(data);
        onOpenChange(false);
        resetAll();
      }
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (regPassword !== regPasswordConfirm) {
      setError("Le password non coincidono");
      return;
    }
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
        setVerifyEmail(regEmail);
        if (data.devCode) setDevHint(data.devCode);
        goTo("verify");
      }
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const code = verifyCode.join("");
    if (code.length < 6) {
      setError("Inserisci il codice a 6 cifre");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyEmail, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Codice non valido");
      } else {
        login(data);
        onOpenChange(false);
        resetAll();
      }
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyEmail }),
      });
      const data = await res.json();
      if (data.devCode) setDevHint(data.devCode);
      setError(null);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (data.devToken) setDevHint(data.devToken);
      goTo("forgot-sent");
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  const dialogTitles: Record<View, string> = {
    login: "Bentornato",
    register: "Crea il tuo account",
    verify: "Conferma la tua email",
    forgot: "Password dimenticata",
    "forgot-sent": "Controlla la tua email",
    "reset-sent": "Password reimpostata",
  };
  const dialogDescriptions: Record<View, string> = {
    login: "Accedi per ritrovare il tuo percorso e i tuoi risultati.",
    register: "Registrati per salvare il tuo percorso e accedere ai contenuti premium.",
    verify: `Inserisci il codice a 6 cifre inviato a ${verifyEmail}.`,
    forgot: "Inserisci la tua email e ti invieremo un link per reimpostare la password.",
    "forgot-sent": `Abbiamo inviato un link a ${forgotEmail}. Controlla la posta in arrivo (e lo spam).`,
    "reset-sent": "La tua password è stata reimpostata. Puoi ora accedere.",
  };

  const showGoogleBtn = (view === "login" || view === "register") && !!(window as any).__GOOGLE_CLIENT_ID__;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetAll(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-5 w-5 text-primary fill-primary" />
            <span className="font-serif font-bold text-lg text-primary">NorthStar</span>
          </div>
          <DialogTitle className="text-xl font-serif">{dialogTitles[view]}</DialogTitle>
          <DialogDescription>{dialogDescriptions[view]}</DialogDescription>
        </DialogHeader>

        {(view === "login" || view === "register") && (
          <div className="flex rounded-xl bg-muted p-1 mb-2">
            <button onClick={() => goTo("login")} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${view === "login" ? "bg-white shadow text-foreground" : "text-muted-foreground"}`}>Accedi</button>
            <button onClick={() => goTo("register")} className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${view === "register" ? "bg-white shadow text-foreground" : "text-muted-foreground"}`}>Registrati</button>
          </div>
        )}

        {(view === "verify" || view === "forgot") && (
          <button onClick={() => goTo("login")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors w-fit">
            <ArrowLeft className="w-3.5 h-3.5" /> Torna al login
          </button>
        )}

        {showGoogleBtn && (
          <div className="space-y-3 mb-1">
            {googleLoading ? (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Accesso con Google in corso…
              </div>
            ) : (
              <div ref={googleBtnRef} className="w-full flex justify-center" />
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">oppure</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>
        )}

        {view === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" placeholder="la-tua@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <button type="button" onClick={() => { setForgotEmail(loginEmail); goTo("forgot"); }} className="text-xs text-primary hover:underline">
                  Hai dimenticato la password?
                </button>
              </div>
              <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full rounded-full font-medium" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Accedi
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Non hai un account?{" "}
              <button type="button" onClick={() => goTo("register")} className="text-primary hover:underline font-medium">
                Registrati
              </button>
            </p>
          </form>
        )}

        {view === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Nome</Label>
              <Input id="reg-name" placeholder="Il tuo nome" value={regName} onChange={(e) => setRegName(e.target.value)} required autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email</Label>
              <Input id="reg-email" type="email" placeholder="la-tua@email.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-password">Password</Label>
              <Input id="reg-password" type="password" placeholder="Min. 6 caratteri" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-password-confirm">Conferma password</Label>
              <Input id="reg-password-confirm" type="password" placeholder="Ripeti la password" value={regPasswordConfirm} onChange={(e) => setRegPasswordConfirm(e.target.value)} required minLength={6} autoComplete="new-password" className={regPasswordConfirm && regPassword !== regPasswordConfirm ? "border-destructive" : ""} />
              {regPasswordConfirm && regPassword !== regPasswordConfirm && (
                <p className="text-xs text-destructive">Le password non coincidono</p>
              )}
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full rounded-full font-medium" disabled={loading || (!!regPasswordConfirm && regPassword !== regPasswordConfirm)}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crea account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Hai già un account?{" "}
              <button type="button" onClick={() => goTo("login")} className="text-primary hover:underline font-medium">
                Accedi
              </button>
            </p>
          </form>
        )}

        {view === "verify" && (
          <form onSubmit={handleVerify} className="space-y-5">
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Mail className="w-7 h-7 text-primary" />
              </div>
            </div>

            {devHint && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-xs text-amber-700 font-medium mb-1">Modalità sviluppo — codice:</p>
                <p className="text-2xl font-mono font-bold tracking-widest text-amber-800">{devHint}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-center block">Codice di verifica</Label>
              <div className="flex gap-2 justify-center" onPaste={handleCodePaste}>
                {verifyCode.map((digit, idx) => (
                  <input key={idx} ref={(el) => { codeRefs.current[idx] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleCodeInput(idx, e.target.value)} onKeyDown={(e) => handleCodeKeyDown(idx, e)} className="w-11 h-13 text-center text-xl font-bold border-2 rounded-xl outline-none focus:border-primary transition-colors bg-background" />
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-center">{error}</p>}

            <Button type="submit" className="w-full rounded-full font-medium" disabled={loading || verifyCode.join("").length < 6}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Verifica account
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Non hai ricevuto il codice?{" "}
              <button type="button" onClick={handleResend} disabled={loading} className="text-primary hover:underline font-medium">
                Invia di nuovo
              </button>
            </p>
          </form>
        )}

        {view === "forgot" && (
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                <KeyRound className="w-7 h-7 text-primary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email del tuo account</Label>
              <Input id="forgot-email" type="email" placeholder="la-tua@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoComplete="email" />
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full rounded-full font-medium" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Invia link di reset
            </Button>
          </form>
        )}

        {view === "forgot-sent" && (
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
            </div>
            {devHint && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700 font-medium mb-1">Modalità sviluppo — token reset:</p>
                <p className="text-xs font-mono text-amber-800 break-all">{devHint}</p>
                <a href={`/reset-password?token=${devHint}`} className="mt-2 inline-block text-xs text-primary underline" onClick={() => onOpenChange(false)}>
                  Apri pagina reset →
                </a>
              </div>
            )}
            <Button variant="outline" className="w-full rounded-full" onClick={() => goTo("login")}>Torna al login</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
