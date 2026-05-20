import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, postJson } from "@/lib/apiClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const BASE = import.meta.env.BASE_URL || "/";

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, "Inserisci la password attuale"),
    newPassword: z.string().min(6, "Minimo 6 caratteri"),
    confirm: z.string().min(1, "Conferma la nuova password"),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Le password non coincidono",
    path: ["confirm"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export function ChangePasswordSection({ userId }: { userId: number }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema as any),
  });

  async function onSubmit(data: PasswordFormData) {
    setServerError(null);
    setSuccess(false);
    try {
      await postJson(`${BASE}api/profile/change-password`, {
        userId,
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
      });
      setSuccess(true);
      reset();
    } catch (error) {
      setServerError(
        error instanceof ApiClientError
          ? error.message
          : "Errore di rete. Riprova.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div>
        <Label htmlFor="old-password">Password attuale</Label>
        <Input
          id="old-password"
          type="password"
          placeholder="••••••••"
          {...register("oldPassword")}
          autoComplete="current-password"
          className={errors.oldPassword ? "border-destructive" : ""}
        />
        {errors.oldPassword && (
          <p className="text-xs text-destructive mt-1">
            {errors.oldPassword.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="new-password">Nuova password</Label>
        <Input
          id="new-password"
          type="password"
          placeholder="Min. 6 caratteri"
          {...register("newPassword")}
          autoComplete="new-password"
          className={errors.newPassword ? "border-destructive" : ""}
        />
        {errors.newPassword && (
          <p className="text-xs text-destructive mt-1">
            {errors.newPassword.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="confirm-password">Conferma nuova password</Label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Ripeti la nuova password"
          {...register("confirm")}
          autoComplete="new-password"
          className={errors.confirm ? "border-destructive" : ""}
        />
        {errors.confirm && (
          <p className="text-xs text-destructive mt-1">
            {errors.confirm.message}
          </p>
        )}
      </div>
      {serverError && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {serverError}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Password aggiornata
        </p>
      )}
      <Button type="submit" className="rounded-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Aggiorna password
      </Button>
    </form>
  );
}
