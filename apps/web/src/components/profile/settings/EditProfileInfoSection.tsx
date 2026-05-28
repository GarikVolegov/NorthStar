import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, patchJson } from "@/lib/apiClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const BASE = import.meta.env.BASE_URL || "/";

const infoSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio").max(100, "Massimo 100 caratteri"),
  bio: z.string().max(300, "Massimo 300 caratteri").optional(),
  city: z.string().max(100, "Massimo 100 caratteri").optional(),
  username: z
    .string()
    .max(30, "Massimo 30 caratteri")
    .regex(/^[a-zA-Z0-9_-]*$/, "Solo lettere, numeri, _ e -")
    .optional(),
});

type InfoFormData = z.infer<typeof infoSchema>;

export type ProfileInfoResult = {
  name: string;
  bio?: string | null;
  city?: string | null;
  username?: string | null;
};

interface EditProfileInfoSectionProps {
  userId: number;
  initialName: string;
  initialBio?: string | null | undefined;
  initialCity?: string | null | undefined;
  initialUsername?: string | null | undefined;
  onSuccess: (result: ProfileInfoResult) => void;
  onCancel: () => void;
}

export function EditProfileInfoSection({
  userId,
  initialName,
  initialBio,
  initialCity,
  initialUsername,
  onSuccess,
  onCancel,
}: EditProfileInfoSectionProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InfoFormData>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      name: initialName,
      bio: initialBio ?? "",
      city: initialCity ?? "",
      username: initialUsername ?? "",
    },
  });

  async function onSubmit(data: InfoFormData) {
    setServerError(null);
    setSuccess(false);
    try {
      const result = await patchJson<ProfileInfoResult>(
        `${BASE}api/profile/${userId}/info`,
        {
          name: data.name,
          bio: data.bio || "",
          city: data.city || "",
          username: data.username || "",
        },
      );
      setSuccess(true);
      setTimeout(() => onSuccess(result), 600);
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
      {/* Nome */}
      <div>
        <Label htmlFor="profile-name">Nome</Label>
        <Input
          id="profile-name"
          type="text"
          placeholder="Il tuo nome"
          autoComplete="name"
          {...register("name")}
          className={errors.name ? "border-destructive" : ""}
        />
        {errors.name && (
          <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Bio */}
      <div>
        <Label htmlFor="profile-bio">Bio <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
        <textarea
          id="profile-bio"
          rows={3}
          placeholder="Raccontati in poche parole..."
          {...register("bio")}
          className={`flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none ${errors.bio ? "border-destructive" : "border-input"}`}
        />
        {errors.bio && (
          <p className="text-xs text-destructive mt-1">{errors.bio.message}</p>
        )}
      </div>

      {/* Città */}
      <div>
        <Label htmlFor="profile-city">Città <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
        <Input
          id="profile-city"
          type="text"
          placeholder="es. Milano"
          autoComplete="address-level2"
          {...register("city")}
          className={errors.city ? "border-destructive" : ""}
        />
        {errors.city && (
          <p className="text-xs text-destructive mt-1">{errors.city.message}</p>
        )}
      </div>

      {/* Username */}
      <div>
        <Label htmlFor="profile-username">Username <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">@</span>
          <Input
            id="profile-username"
            type="text"
            placeholder="tuonome"
            autoComplete="username"
            {...register("username")}
            className={`pl-7 ${errors.username ? "border-destructive" : ""}`}
          />
        </div>
        {errors.username && (
          <p className="text-xs text-destructive mt-1">{errors.username.message}</p>
        )}
      </div>

      {/* Errore server */}
      {serverError && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {serverError}
        </p>
      )}

      {/* Successo */}
      {success && (
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Profilo aggiornato
        </p>
      )}

      {/* Azioni */}
      <div className="flex gap-2 pt-1">
        <Button type="submit" className="rounded-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salva
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Annulla
        </Button>
      </div>
    </form>
  );
}
