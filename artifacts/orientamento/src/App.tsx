import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion, easings, durations } from "@/lib/motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { BackButton } from "@/components/layout/back-button";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const Test = lazy(() => import("@/pages/test"));
const Results = lazy(() => import("@/pages/results"));
const Sector = lazy(() => import("@/pages/sector"));
const Register = lazy(() => import("@/pages/register"));
const Premium = lazy(() => import("@/pages/premium"));
const PremiumSuccess = lazy(() => import("@/pages/premium-success"));
const News = lazy(() => import("@/pages/news"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const Profilo = lazy(() => import("@/pages/profilo"));
const Wiki = lazy(() => import("@/pages/wiki"));
const Roadmap = lazy(() => import("@/pages/roadmap"));
const Grafo = lazy(() => import("@/pages/grafo"));
const GrafoConoscenza = lazy(() => import("@/pages/grafo-conoscenza"));
const Settori = lazy(() => import("@/pages/settori"));
const Confronta = lazy(() => import("@/pages/confronta"));
const Contatti = lazy(() => import("@/pages/contatti"));
const AdminMessaggi = lazy(() => import("@/pages/admin-messaggi"));
const AdminAffiliazione = lazy(() => import("@/pages/admin-affiliazione"));
const AdminReview = lazy(() => import("@/pages/admin-review"));
const SitemapPage = lazy(() => import("@/pages/sitemap"));
const ChiSiamo = lazy(() => import("@/pages/chi-siamo"));
const ComeFunziona = lazy(() => import("@/pages/come-funziona"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TerminiDiServizio = lazy(() => import("@/pages/termini-di-servizio"));
const Crescita = lazy(() => import("@/pages/crescita"));
const CrescitaCategoria = lazy(() => import("@/pages/crescita-categoria"));
const CrescitaArticolo = lazy(() => import("@/pages/crescita-articolo"));
const Candidature = lazy(() => import("@/pages/candidature"));
const Amici = lazy(() => import("@/pages/amici"));
const Utente = lazy(() => import("@/pages/utente"));
const Calendario = lazy(() => import("@/pages/Calendario"));
const Ruolo = lazy(() => import("@/pages/ruolo"));
const Ruoli = lazy(() => import("@/pages/ruoli"));
const Affiliazione = lazy(() => import("@/pages/affiliazione"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const AffiliazioneScuole = lazy(() => import("@/pages/affiliazione-scuole"));
const AffiliazioneUniversita = lazy(() => import("@/pages/affiliazione-universita"));
const AffiliazioneAgenzie = lazy(() => import("@/pages/affiliazione-agenzie"));
const AffiliazioneFormazione = lazy(() => import("@/pages/affiliazione-formazione"));
const Colloquio = lazy(() => import("@/pages/colloquio"));
const SkillsGap = lazy(() => import("@/pages/skills-gap"));
const Coach = lazy(() => import("@/pages/coach"));
const AdminMetriche = lazy(() => import("@/pages/admin-metriche"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 30_000,
    },
  },
});

function AnimatedRoutes() {
  const [location] = useLocation();
  const prefersReduced = useReducedMotion();

  const routes = (loc: string) => (
    <Switch location={loc}>
      <Route path="/" component={Home} />
      <Route path="/test" component={Test} />
      <Route path="/risultati/:id" component={Results} />
      <Route path="/settore/:id" component={Sector} />
      <Route path="/ruolo/:id" component={Ruolo} />
      <Route path="/registra" component={Register} />
      <Route path="/premium" component={Premium} />
      <Route path="/premium/successo" component={PremiumSuccess} />
      <Route path="/news" component={News} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/profilo" component={Profilo} />
      <Route path="/candidature" component={Candidature} />
      <Route path="/calendario" component={Calendario} />
      <Route path="/amici" component={Amici} />
      <Route path="/utente/:id" component={Utente} />
      <Route path="/wiki/:id" component={Wiki} />
      <Route path="/roadmap/:id" component={Roadmap} />
      <Route path="/grafo" component={GrafoConoscenza} />
      <Route path="/grafo/:id" component={Grafo} />
      <Route path="/settori" component={Settori} />
      <Route path="/ruoli" component={Ruoli} />
      <Route path="/confronta" component={Confronta} />
      <Route path="/contatti" component={Contatti} />
      <Route path="/sitemap" component={SitemapPage} />
      <Route path="/chi-siamo" component={ChiSiamo} />
      <Route path="/come-funziona" component={ComeFunziona} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/termini-di-servizio" component={TerminiDiServizio} />
      <Route path="/crescita" component={Crescita} />
      <Route path="/crescita/categoria/:cat" component={CrescitaCategoria} />
      <Route path="/crescita/articolo/:slug" component={CrescitaArticolo} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/affiliazione" component={Affiliazione} />
      <Route path="/affiliazione/scuole" component={AffiliazioneScuole} />
      <Route path="/affiliazione/universita" component={AffiliazioneUniversita} />
      <Route path="/affiliazione/agenzie-lavoro" component={AffiliazioneAgenzie} />
      <Route path="/affiliazione/centri-formazione" component={AffiliazioneFormazione} />
      <Route path="/colloquio/:id" component={Colloquio} />
      <Route path="/skills-gap/:id" component={SkillsGap} />
      <Route path="/coach" component={Coach} />
      <Route component={NotFound} />
    </Switch>
  );

  if (prefersReduced) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {routes(location)}
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: durations.slow, ease: easings.easeOut },
          }}
          exit={{
            opacity: 0,
            y: -6,
            transition: { duration: durations.normal, ease: easings.easeIn },
          }}
          style={{ willChange: "opacity, transform" }}
        >
          <Suspense fallback={<PageLoader />}>
            {routes(location)}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </ErrorBoundary>
  );
}

function Router() {
  return (
    <Switch>
      {/* Admin — no navbar/footer */}
      <Route path="/admin/messaggi">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <AdminMessaggi />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/affiliazione">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <AdminAffiliazione />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/review">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <AdminReview />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/metriche">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <AdminMetriche />
          </Suspense>
        </ErrorBoundary>
      </Route>

      {/* Public layout */}
      <Route>
        <div className="flex flex-col min-h-[100dvh]">
          <Navbar />
          <main className="flex-1">
            <BackButton />
            <AnimatedRoutes />
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
