import { Route, Switch, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { SmartSkeleton } from "@/components/ui/SmartSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ─── Lazy imports (TUTTI in cima — prima di qualsiasi uso nel JSX) ─────────────
// TDZ crash se dichiarati dopo il componente che li usa
const HomePage = lazy(() => import("@/pages/home"));
const TestPage = lazy(() => import("@/pages/test"));
const ResultsPage = lazy(() => import("@/pages/results"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const SectorsPage = lazy(() => import("@/pages/settori"));
const SectorPage = lazy(() => import("@/pages/sector"));
const RoadmapPage = lazy(() => import("@/pages/percorso"));
const GraphPage = lazy(() => import("@/pages/grafo"));
const WikiPage = lazy(() => import("@/pages/wiki"));
const NewsPage = lazy(() => import("@/pages/news"));
const ProfilePage = lazy(() => import("@/pages/profilo"));
const LoginPage = lazy(() => import("@/pages/login"));
const RegisterPage = lazy(() => import("@/pages/register"));
const AdminHome = lazy(() => import("@/pages/admin-home"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));
const PremiumPage = lazy(() => import("@/pages/premium")); // ← rotta /premium mancante
const LazyComeFunziona = lazy(() => import("@/pages/come-funziona"));
const LazyChiSiamo = lazy(() => import("@/pages/chi-siamo"));
const LazyContatti = lazy(() => import("@/pages/contatti"));
const LazyCalendario = lazy(() => import("@/pages/calendar"));
const LazyCertificazioni = lazy(() => import("@/pages/certificato"));
const LazyCandidature = lazy(() => import("@/pages/candidature"));
const LazyAmici = lazy(() => import("@/pages/amici"));
const LazyScoreCard = lazy(() => import("@/pages/score-card"));
const LazyCoach = lazy(() => import("@/pages/coach"));
const LazyColloquio = lazy(() => import("@/pages/colloquio"));
const LazySkillsGap = lazy(() => import("@/pages/skills-gap"));
const LazyValidatore = lazy(() => import("@/pages/validatore-idea"));
const LazyGrafoConoscenza = lazy(() => import("@/pages/grafo-conoscenza"));

// ─── PageWrapper ─────────────────────────────────────────────────────────────
// Aggiunge key={location} così AnimatePresence mode="wait" può rilevare
// il cambio di route e triggerare exit + enter in sequenza.
// Senza key, AnimatePresence non sa che il componente è cambiato.
function PageWrapper({
  children,
  locationKey,
}: {
  children: React.ReactNode;
  locationKey: string;
}) {
  return (
    <motion.div
      key={locationKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
    >
      <ErrorBoundary>
        <Suspense fallback={<SmartSkeleton type="card" />}>{children}</Suspense>
      </ErrorBoundary>
    </motion.div>
  );
}

// ─── Route Guards ────────────────────────────────────────────────────────────
function AuthRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation(
        "/login?redirect=" + encodeURIComponent(window.location.pathname),
      );
    }
  }, [user, isLoading, setLocation]);

  if (isLoading)
    return <SmartSkeleton type="card" message="Verifica autenticazione..." />;
  if (!user) return null;
  return <Component />;
}

function PremiumRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation(
        "/login?redirect=" + encodeURIComponent(window.location.pathname),
      );
      return;
    }
    if (!isLoading && user && !user.isPremium) {
      // /premium deve essere una route dichiarata — aggiunta sopra
      setLocation("/premium");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return <SmartSkeleton type="card" />;
  if (!user?.isPremium) return null;
  return <Component />;
}

function AdminRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user } = useAuth();
  // NotFoundPage è lazy: serve Suspense altrimenti crash
  if (!user?.isAdmin) {
    return (
      <Suspense fallback={<SmartSkeleton type="card" />}>
        <NotFoundPage />
      </Suspense>
    );
  }
  return <Component />;
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location]);

  // Helper per ridurre boilerplate: wrap con key di location per AnimatePresence
  const pw = (node: React.ReactNode) => (
    <PageWrapper locationKey={location}>{node}</PageWrapper>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] pb-20 md:pb-0">
        <Navbar />

        <main className="relative">
          {/*
           * AnimatePresence mode="wait" richiede che i figli diretti abbiano
           * una key stabile che cambia al cambio di route. PageWrapper
           * riceve locationKey={location} e la passa a motion.div key={locationKey}.
           * Senza questo, AnimatePresence non sa che il contenuto è cambiato
           * e non triggera l'animazione exit.
           */}
          <AnimatePresence mode="wait">
            <Switch>
              {/* ── Pubblico ───────────────────────────────────────────────── */}
              <Route path="/" component={() => pw(<HomePage />)} />
              <Route path="/test" component={() => pw(<TestPage />)} />
              <Route path="/risultati" component={() => pw(<ResultsPage />)} />
              <Route path="/login" component={() => pw(<LoginPage />)} />
              <Route path="/register" component={() => pw(<RegisterPage />)} />
              <Route path="/premium" component={() => pw(<PremiumPage />)} />
              <Route
                path="/come-funziona"
                component={() => pw(<LazyComeFunziona />)}
              />
              <Route path="/chi-siamo" component={() => pw(<LazyChiSiamo />)} />
              <Route path="/contatti" component={() => pw(<LazyContatti />)} />
              <Route
                path="/score/:userId"
                component={() => pw(<LazyScoreCard />)}
              />

              {/* ── Autenticato ────────────────────────────────────────────── */}
              <Route
                path="/dashboard"
                component={() => pw(<AuthRoute component={DashboardPage} />)}
              />
              <Route
                path="/settori"
                component={() => pw(<AuthRoute component={SectorsPage} />)}
              />
              <Route
                path="/settore/:id"
                component={() => pw(<AuthRoute component={SectorPage} />)}
              />
              <Route
                path="/profilo"
                component={() => pw(<AuthRoute component={ProfilePage} />)}
              />
              <Route
                path="/profilo/:id"
                component={() => pw(<AuthRoute component={ProfilePage} />)}
              />
              <Route
                path="/calendario"
                component={() => pw(<AuthRoute component={LazyCalendario} />)}
              />
              <Route
                path="/certificazioni"
                component={() =>
                  pw(<AuthRoute component={LazyCertificazioni} />)
                }
              />
              <Route
                path="/candidature"
                component={() => pw(<AuthRoute component={LazyCandidature} />)}
              />
              <Route
                path="/amici"
                component={() => pw(<AuthRoute component={LazyAmici} />)}
              />

              {/* ── Premium ────────────────────────────────────────────────── */}
              <Route
                path="/percorso"
                component={() => pw(<PremiumRoute component={RoadmapPage} />)}
              />
              <Route
                path="/mappa"
                component={() => pw(<PremiumRoute component={GraphPage} />)}
              />
              <Route
                path="/wiki"
                component={() => pw(<PremiumRoute component={WikiPage} />)}
              />
              <Route
                path="/news"
                component={() => pw(<PremiumRoute component={NewsPage} />)}
              />
              <Route
                path="/coach"
                component={() => pw(<PremiumRoute component={LazyCoach} />)}
              />
              <Route
                path="/colloquio"
                component={() => pw(<PremiumRoute component={LazyColloquio} />)}
              />
              <Route
                path="/skills-gap"
                component={() => pw(<PremiumRoute component={LazySkillsGap} />)}
              />
              <Route
                path="/validatore-idea"
                component={() =>
                  pw(<PremiumRoute component={LazyValidatore} />)
                }
              />
              <Route
                path="/grafo-conoscenza"
                component={() =>
                  pw(<PremiumRoute component={LazyGrafoConoscenza} />)
                }
              />

              {/* ── Admin ──────────────────────────────────────────────────── */}
              <Route
                path="/admin"
                component={() => pw(<AdminRoute component={AdminHome} />)}
              />
              <Route
                path="/admin/:section"
                component={() => pw(<AdminRoute component={AdminHome} />)}
              />

              {/* ── 404 ────────────────────────────────────────────────────── */}
              <Route component={() => pw(<NotFoundPage />)} />
            </Switch>
          </AnimatePresence>
        </main>

        <BottomNav />
      </div>
    </QueryClientProvider>
  );
}
