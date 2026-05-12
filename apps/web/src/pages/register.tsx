import { useLocation } from "wouter";
import { useRegisterUser, type RegisterUserBody } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, Mail, User as UserIcon, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Nome troppo corto (min. 2 caratteri)").max(80, "Nome troppo lungo"),
  email: z.string().email("Inserisci un indirizzo email valido"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const registerUser = useRegisterUser();

  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("session") ? parseInt(searchParams.get("session") as string, 10) : null;
  const pendingWorkMode = searchParams.get("work_mode");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (data: RegisterFormData) => {
    registerUser.mutate(
      { data: { name: data.name, email: data.email, testSessionId: sessionId, workPreference: pendingWorkMode ?? undefined } as RegisterUserBody & { workPreference?: string } },
      {
        onSuccess: (res) => {
          const { token, ...user } = res as typeof res & { token: string };
          login(user as Parameters<typeof login>[0], token);
          setLocation(sessionId ? `/risultati/${sessionId}` : "/");
        },
        onError: () => {
          toast({ title: t("register.errors.registerError"), description: t("register.errors.registerErrorDesc"), variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="container mx-auto px-4 py-12 md:py-24 flex justify-center min-h-[80vh] items-center">
      <div className="grid md:grid-cols-2 gap-12 max-w-4xl w-full items-center">

        <div className="space-y-6 hidden md:block">
          <Compass className="w-12 h-12 text-primary" />
          <h2 className="text-3xl font-serif font-bold text-foreground">{t("register.title")}</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">{t("register.subtitle")}</p>
          <ul className="space-y-4 pt-4">
            <li className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span>{t("register.benefits.riasec")}</span>
            </li>
            <li className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span>{t("register.benefits.stepByStep")}</span>
            </li>
            <li className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span>{t("register.benefits.track")}</span>
            </li>
          </ul>
        </div>

        <Card className="rounded-3xl shadow-lg border">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-serif">{t("register.formTitle")}</CardTitle>
            <CardDescription>{t("register.formSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="name">{t("register.name")}</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder={t("register.name")}
                    {...register("name")}
                    className={`pl-9 rounded-xl ${errors.name ? "border-destructive" : ""}`}
                    autoComplete="name"
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("register.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="la-tua@email.com"
                    {...register("email")}
                    className={`pl-9 rounded-xl ${errors.email ? "border-destructive" : ""}`}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full rounded-full h-12"
                disabled={registerUser.isPending || isSubmitting}
              >
                {registerUser.isPending ? t("register.registering") : t("register.createAccount")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
