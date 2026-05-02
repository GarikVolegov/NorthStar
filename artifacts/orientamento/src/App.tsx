import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Test from "@/pages/test";
import Results from "@/pages/results";
import Sector from "@/pages/sector";
import Register from "@/pages/register";
import Premium from "@/pages/premium";
import PremiumSuccess from "@/pages/premium-success";
import News from "@/pages/news";
import ResetPassword from "@/pages/reset-password";
import Profilo from "@/pages/profilo";
import Wiki from "@/pages/wiki";
import Roadmap from "@/pages/roadmap";
import Grafo from "@/pages/grafo";
import Settori from "@/pages/settori";
import Confronta from "@/pages/confronta";
import Contatti from "@/pages/contatti";
import AdminMessaggi from "@/pages/admin-messaggi";
import AdminAffiliazione from "@/pages/admin-affiliazione";
import SitemapPage from "@/pages/sitemap";
import ChiSiamo from "@/pages/chi-siamo";
import ComeFunziona from "@/pages/come-funziona";
import PrivacyPolicy from "@/pages/privacy-policy";
import TerminiDiServizio from "@/pages/termini-di-servizio";
import Affiliazione from "@/pages/affiliazione";
import AffiliazioneScuole from "@/pages/affiliazione-scuole";
import AffiliazioneUniversita from "@/pages/affiliazione-universita";
import AffiliazioneAgenzie from "@/pages/affiliazione-agenzie";
import AffiliazioneFormazione from "@/pages/affiliazione-formazione";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { BackButton } from "@/components/layout/back-button";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Admin — no navbar/footer */}
      <Route path="/admin/messaggi" component={AdminMessaggi} />
      <Route path="/admin/affiliazione" component={AdminAffiliazione} />

      {/* Public layout */}
      <Route>
        <div className="flex flex-col min-h-[100dvh]">
          <Navbar />
          <main className="flex-1">
            <BackButton />
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/test" component={Test} />
              <Route path="/risultati/:id" component={Results} />
              <Route path="/settore/:id" component={Sector} />
              <Route path="/registra" component={Register} />
              <Route path="/premium" component={Premium} />
              <Route path="/premium/successo" component={PremiumSuccess} />
              <Route path="/news" component={News} />
              <Route path="/reset-password" component={ResetPassword} />
              <Route path="/profilo" component={Profilo} />
              <Route path="/wiki/:id" component={Wiki} />
              <Route path="/roadmap/:id" component={Roadmap} />
              <Route path="/grafo/:id" component={Grafo} />
              <Route path="/settori" component={Settori} />
              <Route path="/confronta" component={Confronta} />
              <Route path="/contatti" component={Contatti} />
              <Route path="/sitemap" component={SitemapPage} />
              <Route path="/chi-siamo" component={ChiSiamo} />
              <Route path="/come-funziona" component={ComeFunziona} />
              <Route path="/privacy-policy" component={PrivacyPolicy} />
              <Route path="/termini-di-servizio" component={TerminiDiServizio} />
              <Route path="/affiliazione" component={Affiliazione} />
              <Route path="/affiliazione/scuole" component={AffiliazioneScuole} />
              <Route path="/affiliazione/universita" component={AffiliazioneUniversita} />
              <Route path="/affiliazione/agenzie-lavoro" component={AffiliazioneAgenzie} />
              <Route path="/affiliazione/centri-formazione" component={AffiliazioneFormazione} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <Footer />
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
