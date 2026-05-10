/**
 * dashboard/index.tsx — DashboardRouter
 *
 * Legge il journeyType dell'utente autenticato e renderizza
 * la dashboard specifica per il suo percorso.
 *
 * journeyType values (dal DB):
 *   indeciso | in_transizione | in_crescita | autonomo | null
 *
 * null/undefined → DashboardOnboarding (utente nuovo, non ha ancora
 *                  completato il test di orientamento)
 */
import { lazy, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SmartSkeleton } from '@/components/ui/SmartSkeleton';
import { motion } from 'framer-motion';

const DashboardIndeciso     = lazy(() => import('./DashboardIndeciso'));
const DashboardTransizione  = lazy(() => import('./DashboardTransizione'));
const DashboardCrescita     = lazy(() => import('./DashboardCrescita'));
const DashboardAutonomo     = lazy(() => import('./DashboardAutonomo'));
const DashboardOnboarding   = lazy(() => import('./DashboardOnboarding'));

export default function DashboardRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <SmartSkeleton type="card" message="Caricamento dashboard..." />;
  }

  const journey = (user as any)?.journeyType as string | null | undefined;

  const dashboardMap: Record<string, React.LazyExoticComponent<() => JSX.Element>> = {
    indeciso:       DashboardIndeciso,
    in_transizione: DashboardTransizione,
    in_crescita:    DashboardCrescita,
    autonomo:       DashboardAutonomo,
  };

  const Component = journey ? (dashboardMap[journey] ?? DashboardOnboarding) : DashboardOnboarding;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Suspense fallback={<SmartSkeleton type="card" message="Caricamento dashboard..." />}>
        <Component />
      </Suspense>
    </motion.div>
  );
}
