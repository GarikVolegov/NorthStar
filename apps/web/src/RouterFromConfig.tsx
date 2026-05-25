import { lazy, Suspense, type ReactNode } from "react";
import { Route, Switch } from "wouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/layouts/AdminLayout";
import { PlainLayout } from "@/layouts/PlainLayout";
import type { RouteConfig, RouteLayout } from "./route-config";

function Layout({
  layout = "default",
  children,
}: {
  layout?: RouteLayout | undefined;
  children: ReactNode;
}) {
  if (layout === "admin") return <AdminLayout>{children}</AdminLayout>;
  if (layout === "plain") return <PlainLayout>{children}</PlainLayout>;
  return <>{children}</>;
}

const lazyRoutes = new WeakMap<RouteConfig, React.LazyExoticComponent<RouteConfig["component"] extends () => Promise<{ default: infer C }> ? C : never>>();

function getLazyComponent(route: RouteConfig) {
  const cached = lazyRoutes.get(route);
  if (cached) return cached;
  const Component = lazy(route.component);
  lazyRoutes.set(route, Component);
  return Component;
}

function GuardedRoute({ route }: { route: RouteConfig }) {
  const Component = getLazyComponent(route);
  const content =
    route.guard === "protected" ? (
      <ProtectedRoute component={Component} />
    ) : route.guard === "publicOnly" ? (
      <PublicOnlyRoute component={Component} />
    ) : (
      <Component />
    );

  return (
    <Layout layout={route.layout}>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>{content}</Suspense>
      </ErrorBoundary>
    </Layout>
  );
}

export function RouterFromConfig({
  routes,
  location,
  fallback,
}: {
  routes: RouteConfig[];
  location?: string;
  fallback?: ReactNode;
}) {
  const switchProps = location === undefined ? {} : { location };

  return (
    <Switch {...switchProps}>
      {routes.map((route) => (
        <Route key={route.path} path={route.path}>
          <GuardedRoute route={route} />
        </Route>
      ))}
      {fallback ? <Route>{fallback}</Route> : null}
    </Switch>
  );
}
