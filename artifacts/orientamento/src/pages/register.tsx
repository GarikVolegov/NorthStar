import React, { useState } from "react";
import { useLocation } from "wouter";
import { useRegisterUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, Mail, User as UserIcon, CheckCircle2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function Register() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const registerUser = useRegisterUser();

  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("session") ? parseInt(searchParams.get("session") as string, 10) : null;
  const pendingWorkMode = searchParams.get("work_mode");

  const [formData, setFormData] = useState({ name: "", email: "" });
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast({ title: t("register.errors.missingData"), description: t("register.errors.missingDataDesc"), variant: "destructive" });
      return;
    }
    registerUser.mutate({
      data: { name: formData.name, email: formData.email, testSessionId: sessionId, workPreference: pendingWorkMode ?? undefined }
    }, {
      onSuccess: () => { setIsSuccess(true); },
      onError: () => {
        toast({ title: t("register.errors.registerError"), description: t("register.errors.registerErrorDesc"), variant: "destructive" });
      }
    });
  };

  if (isSuccess) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">{t("register.successTitle", { name: formData.name.split(" ")[0] })}</h1>
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{t("register.successDesc")}</p>
        <Button size="lg" onClick={() => setLocation("/")} className="rounded-full px-8 h-14">
          {t("register.backHome")} <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    );
  }

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
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">{t("register.name")}</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder={t("register.name")}
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="pl-9 rounded-xl"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("register.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="la-tua@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-9 rounded-xl"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full rounded-full h-12" disabled={registerUser.isPending}>
                {registerUser.isPending ? t("register.registering") : t("register.createAccount")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
