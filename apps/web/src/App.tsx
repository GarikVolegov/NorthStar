import { lazy, Suspense } from "react";
import {
  Switch,
  Route,
  Router as WouterRouter,
  useLocation,
  Redirect,
} from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { WendyProvider } from "@/contexts/WendyProvider";

import { WendyPanel } from "@/components/WendyPanel";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import { useReducedMotion, easings } from "@/lib/motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/footer";
import { BackButton } from "@/components/layout/back-button";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/ProtectedRoute";

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
const Archivio = lazy(() => import("@/pages/grafo-conoscenza"));
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
const Crescita = lazy(() => import("@/pages/growth"));
const CrescitaCategoria = lazy(() => import("@/pages/crescita-categoria"));
const CrescitaArticolo = lazy(() => import("@/pages/crescita-articolo"));
const Candidature = lazy(() => import("@/pages/applications"));
const Amici = lazy(() => import("@/pages/amici"));
const Utente = lazy(() => import("@/pages/utente"));
const Calendario = lazy(() => import("@/pages/calendar"));
const Ruolo = lazy(() => import("@/pages/ruolo"));
const Ruoli = lazy(() => import("@/pages/ruoli"));
const Affiliazione = lazy(() => import("@/pages/affiliazione"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const AffiliazioneScuole = lazy(() => import("@/pages/affiliazione-scuole"));
const AffiliazioneUniversita = lazy(
  () => import("@/pages/affiliazione-universita"),
);
const AffiliazioneAgenzie = lazy(() => import("@/pages/affiliazione-agenzie"));
const AffiliazioneFormazione = lazy(
  () => import("@/pages/affiliazione-formazione"),
);
// ── Fase 4: Dashboard affiliato (area privata) ─────────────────────────────
const AffiliazioneDashboard = lazy(
  () => import("@/pages/affiliazione-dashboard"),
);
const Colloquio = lazy(() => import("@/pages/colloquio"));
const SkillsGap = lazy(() => import("@/pages/skills-gap"));
const Coach = lazy(() => import("@/pages/coach"));
const IdeaPage = lazy(() => import("@/pages/validatore-idea"));
const Percorso = lazy(() => import("@/pages/percorso"));
const ScoreCard = lazy(() => import("@/pages/score-card"));
const Lavori = lazy(() => import("@/pages/lavori"));
const AdminMetriche = lazy(() => import("@/pages/admin-metriche"));
const AdminStatus = lazy(() => import("@/pages/admin-status"));
const AdminHome = lazy(() => import("@/pages/admin-home"));
const AdminAgenti = lazy(() => import("@/pages/admin-agenti"));
const AdminCataloghi = lazy(() => import("@/pages/admin-cataloghi"));
const AdminCrescita = lazy(() => import("@/pages/admin-crescita"));
const CertificatePage = lazy(() => import("@/pages/certificato"));

/**
 * QueryClient ottimizzato:
 * - staleTime 5 min: non refetcha se i dati sono freschi
 * - gcTime 30 min: mantiene in cache anche le query non montate
 * - refetchOnWindowFocus false: evita refetch inutili al cambio tab
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
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
      <Route path="/registra">
        <PublicOnlyRoute component={Register} />
      </Route>
      <Route path="/reset-password">
        <PublicOnlyRoute component={ResetPassword} />
      </Route>
      <Route path="/premium" component={Premium} />
      <Route path="/premium/successo">
        <ProtectedRoute component={PremiumSuccess} />
      </Route>
      <Route path="/news" component={News} />
      <Route path="/profilo">
        <ProtectedRoute component={Profilo} />
      </Route>
      <Route path="/candidature">
        <ProtectedRoute component={Candidature} />
      </Route>
      <Route path="/calendario">
        <ProtectedRoute component={Calendario} />
      </Route>
      <Route path="/amici">
        <ProtectedRoute component={Amici} />
      </Route>
      <Route path="/utente/:id" component={Utente} />
      <Route path="/wiki/:id">
        <ProtectedRoute component={Wiki} />
      </Route>
      <Route path="/roadmap/:id">
        <ProtectedRoute component={Roadmap} />
      </Route>
      {/* Archivio — new canonical routes */}
      <Route path="/archivio">
        <ProtectedRoute component={Archivio} />
      </Route>
      <Route path="/archivio/:id">
        <ProtectedRoute component={Grafo} />
      </Route>
      {/* Legacy /grafo routes — permanent redirect to /archivio */}
      <Route path="/grafo">
        <Redirect to="/archivio" />
      </Route>
      <Route path="/grafo/:id">
        {(params) => <Redirect to={`/archivio/${params.id}`} />}
      </Route>
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
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/affiliazione" component={Affiliazione} />
      <Route path="/affiliazione/scuole" component={AffiliazioneScuole} />
      <Route
        path="/affiliazione/universita"
        component={AffiliazioneUniversita}
      />
      <Route
        path="/affiliazione/agenzie-lavoro"
        component={AffiliazioneAgenzie}
      />
      <Route
        path="/affiliazione/centri-formazione"
        component={AffiliazioneFormazione}
      />
      {/* Fase 4: dashboard privata affiliato — DOPO le route pubbliche /affiliazione/* */}
      <Route path="/affiliazione/dashboard">
        <ProtectedRoute component={AffiliazioneDashboard} />
      </Route>
      <Route path="/colloquio/:id">
        <ProtectedRoute component={Colloquio} />
      </Route>
      <Route path="/skills-gap/:id">
        <ProtectedRoute component={SkillsGap} />
      </Route>
      <Route path="/coach" component={Coach} />
      <Route path="/validatore-idea">
        <ProtectedRoute component={IdeaPage} />
      </Route>
      <Route path="/percorso">
        <ProtectedRoute component={Percorso} />
      </Route>
      <Route path="/score/:userId" component={ScoreCard} />
      <Route path="/lavori" component={Lavori} />
      <Route component={NotFound} />
    </Switch>
  );

  if (prefersReduced) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>{routes(location)}</Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <LazyMotion features={domAnimation} strict>
        <AnimatePresence mode="sync" initial={false}>
          <m.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: 0.12, ease: easings.easeOut },
            }}
            exit={{
              opacity: 0,
              y: -4,
              transition: { duration: 0.08, ease: easings.easeIn },
            }}
          >
            <Suspense fallback={<PageLoader />}>{routes(location)}</Suspense>
          </m.div>
        </AnimatePresence>
      </LazyMotion>
    </ErrorBoundary>
  );
}

function Router() {
  return (
    <Switch>
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
      <Route path="/admin/status">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <AdminStatus />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/agenti">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <AdminAgenti />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/cataloghi">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <AdminCataloghi />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/crescita">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <AdminCrescita />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/admin">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <AdminHome />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/certificato/:hash">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <CertificatePage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route>
        <div className="flex flex-col min-h-dvh">
          <MobileBottomNav />
          <main className="flex-1 pt-12 md:pt-14 pb-16 md:pb-16">
            <BackButton />
            <AnimatedRoutes />
          </main>
          <div className="hidden md:block">
            <Footer />
          </div>
          <Navbar />
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WendyProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
            <WendyPanel />
          </WendyProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
