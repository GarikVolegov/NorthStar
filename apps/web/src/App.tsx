import { TooltipProvider } from "@/components/ui/tooltip";
import { UserBackgroundLayer } from "@/components/user-background/UserBackgroundLayer";
import { WendyInsightToastRunner } from "@/components/wendy/WendyInsightToastRunner";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminAgentProvider } from "@/contexts/AdminAgentContext";
import { WendyProvider } from "@/contexts/WendyProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Suspense, lazy } from "react";
import { Toaster } from "sonner";
import {
  Redirect,
  Route,
  Switch,
  Router as WouterRouter,
  useLocation,
} from "wouter";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/layouts/MainLayout";
import { easings, useReducedMotion } from "@/lib/motion";
import { RouterFromConfig } from "@/RouterFromConfig";
import { routes as mainRoutes } from "@/route-config";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";

const NotFound = lazy(() => import("@/pages/not-found"));
const AdminReview = lazy(() => import("@/pages/admin-review"));
const AdminOffice = lazy(() => import("@/pages/admin-office"));
const MemoriaWendy = lazy(() => import("@/pages/memoria-wendy"));
const WorkspacePage = lazy(() => import("@/pages/workspace"));
const BriefingPage = lazy(() => import("@/pages/briefing"));
const CertificatePage = lazy(() => import("@/pages/certificato"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const SignUpPage = lazy(() => import("@/pages/sign-up"));
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
  const content = (
    <RouterFromConfig
      routes={mainRoutes}
      location={location}
      fallback={<NotFound />}
    />
  );

  if (prefersReduced) {
    return content;
  }

  return (
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
          {content}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
function Router() {
  return (
    <Switch>
      <Route path="/admin/office">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute component={AdminOffice} />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/admin/:section">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute component={AdminReview} />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/wendy/memoria">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <MemoriaWendy />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/workspace">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <WorkspacePage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/profilo/briefing">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <BriefingPage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/admin">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute component={AdminReview} />
          </Suspense>
        </ErrorBoundary>
      </Route>
      {/* Clerk auth pages: routing="path" requires dedicated escape-hatch routes. */}
      <Route path="/sign-in">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <SignInPage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/sign-in/:rest*">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <SignInPage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/sign-up">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <SignUpPage />
          </Suspense>
        </ErrorBoundary>
      </Route>
      <Route path="/sign-up/:rest*">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <SignUpPage />
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
      <Route path="/grafo">
        <Redirect to="/archivio" />
      </Route>
      <Route path="/grafo/:id">
        {(params) => <Redirect to={`/archivio/${params.id}`} />}
      </Route>
      <Route>
        <MainLayout>
          <AnimatedRoutes />
        </MainLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppStateProvider>
            <TooltipProvider>
              <WendyProvider>
                <AdminAgentProvider>
                  <UserBackgroundLayer />
                  <div className="relative z-10 min-h-screen">
                    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                      <Router />
                    </WouterRouter>
                  </div>
                  <WendyInsightToastRunner />
                  <Toaster />
                </AdminAgentProvider>
              </WendyProvider>
            </TooltipProvider>
          </AppStateProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
