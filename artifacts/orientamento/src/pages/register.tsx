import React, { useState } from "react";
import { useLocation } from "wouter";
import { useRegisterUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, Mail, User as UserIcon, CheckCircle2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const registerUser = useRegisterUser();
  
  // Extract session ID from URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("session") ? parseInt(searchParams.get("session") as string, 10) : null;

  const [formData, setFormData] = useState({
    name: "",
    email: ""
  });
  
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      toast({
        title: "Dati mancanti",
        description: "Inserisci nome ed email per procedere.",
        variant: "destructive"
      });
      return;
    }

    registerUser.mutate({ 
      data: { 
        name: formData.name, 
        email: formData.email,
        testSessionId: sessionId
      } 
    }, {
      onSuccess: () => {
        setIsSuccess(true);
      },
      onError: () => {
        toast({
          title: "Errore di registrazione",
          description: "Si è verificato un errore durante la registrazione. Riprova.",
          variant: "destructive"
        });
      }
    });
  };

  if (isSuccess) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">Benvenuto a bordo, {formData.name.split(" ")[0]}!</h1>
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
          Il tuo profilo è stato salvato con successo. Ti abbiamo inviato un'email con la roadmap dettagliata per il settore che hai scelto.
        </p>
        <Button 
          size="lg" 
          onClick={() => setLocation("/")} 
          className="rounded-full px-8 h-14"
        >
          Torna alla Home <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-24 flex justify-center min-h-[80vh] items-center">
      <div className="grid md:grid-cols-2 gap-12 max-w-4xl w-full items-center">
        
        <div className="space-y-6 hidden md:block">
          <Compass className="w-12 h-12 text-primary" />
          <h2 className="text-3xl font-serif font-bold text-foreground">Il viaggio inizia ora.</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Registrati per salvare i risultati del tuo test e ricevere una roadmap personalizzata.
          </p>
          <ul className="space-y-4 pt-4">
            <li className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span>Analisi dettagliata del tuo profilo RIASEC</span>
            </li>
            <li className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span>Guide passo-passo per il settore confermato</span>
            </li>
            <li className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span>Risorse formative raccomandate</span>
            </li>
          </ul>
        </div>

        <Card className="border-2 shadow-xl rounded-2xl w-full">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl font-serif">Salva il tuo percorso</CardTitle>
            <CardDescription className="text-base">
              Crea un account gratuito per accedere alla tua roadmap.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Nome Completo</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input 
                    id="name" 
                    placeholder="Mario Rossi" 
                    className="pl-10 h-12 bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-colors"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Indirizzo Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="mario@esempio.it" 
                    className="pl-10 h-12 bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-colors"
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2 pb-8">
              <Button 
                type="submit" 
                className="w-full h-12 text-lg rounded-xl"
                disabled={registerUser.isPending}
              >
                {registerUser.isPending ? "Registrazione in corso..." : "Ottieni la mia Roadmap"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
