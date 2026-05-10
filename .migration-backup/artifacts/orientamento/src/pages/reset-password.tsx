import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Star, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

export default function ResetPassword() {
  const { t } = useTranslation();
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
        <h1 className="text-2xl font-serif font-bold mb-2">{t("resetPassword.invalidLinkTitle")}</h1>
        <p className="text-muted-foreground mb-6">{t("resetPassword.invalidLinkDesc")}</p>
        <Button onClick={() => setLocation("/")}>{t("resetPassword.goHome")}</Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-serif font-bold mb-2">{t("resetPassword.successTitle")}</h1>
        <p className="text-muted-foreground mb-6">{t("resetPassword.successDesc")}</p>
        <Button onClick={() => setLocation("/")} className="rounded-full px-8">
          {t("resetPassword.goLogin")}
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t("resetPassword.passwordMismatch"));
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
        setError(data.error || t("resetPassword.resetError"));
      } else {
        setDone(true);
      }
    } catch {
      setError(t("resetPassword.networkError"));
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

        <h1 className="text-2xl font-serif font-bold mb-1">{t("resetPassword.newPasswordLabel")}</h1>
        <p className="text-muted-foreground text-sm mb-6">{t("resetPassword.chooseNew")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">{t("resetPassword.newPasswordLabel")}</Label>
            <Input
              id="new-password"
              type="password"
              placeholder={t("resetPassword.passwordPlaceholder")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">{t("resetPassword.confirmPasswordLabel")}</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder={t("resetPassword.confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={confirmPassword && newPassword !== confirmPassword ? "border-destructive" : ""}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">{t("resetPassword.passwordMismatch")}</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

          <Button
            type="submit"
            className="w-full rounded-full font-medium"
            disabled={loading || (!!confirmPassword && newPassword !== confirmPassword)}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {loading ? t("resetPassword.resetting") : t("resetPassword.reset")}
          </Button>
        </form>
      </div>
    </div>
  );
}
