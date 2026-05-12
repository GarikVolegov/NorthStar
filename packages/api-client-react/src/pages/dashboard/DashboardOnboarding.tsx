/**
 * DashboardOnboarding.tsx
 *
 * Mostrata quando l'utente non ha ancora un journeyType.
 * Invita a fare il test per ottenere la dashboard personalizzata.
 */
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Compass, ArrowRight, HelpCircle, Users, Map } from 'lucide-react';

const STEPS = [
  { num: '01', icon: HelpCircle,  title: 'Fai il test',           desc: 'Rispondi a poche domande sul tuo momento professionale',  href: '/test',    cta: 'Inizia il test' },
  { num: '02', icon: Map,         title: 'Ricevi il tuo percorso', desc: 'NorthStar ti assegna la dashboard giusta per te',         href: '/test',    cta: 'Scopri il percorso' },
  { num: '03', icon: Users,       title: 'Connettiti',             desc: 'Incontra persone nello stesso momento professionale',      href: '/amici',   cta: 'Vai al network' },
];

export default function DashboardOnboarding() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-10"
      >
        <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--background))] border border-white/[0.06]
                        flex items-center justify-center mx-auto mb-4">
          <Compass className="w-8 h-8 text-[hsl(var(--chart-3))]" />
        </div>
        <h1 className="text-[22px] font-bold text-[hsl(var(--foreground))] mb-2">
          Benvenuto su NorthStar
        </h1>
        <p className="text-[14px] text-[hsl(var(--muted-foreground))] max-w-[38ch] mx-auto leading-relaxed">
          Per mostrarti la dashboard giusta, dobbiamo capire
          in quale momento del tuo percorso professionale sei.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-3 mb-8"
      >
        {STEPS.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-start gap-4 p-4 rounded-2xl bg-[hsl(var(--background))] border border-white/[0.06]"
          >
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center
                            flex-shrink-0 text-[11px] font-bold text-[hsl(var(--chart-3))]">
              {step.num}
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[hsl(var(--foreground))] mb-0.5">{step.title}</p>
              <p className="text-[12px] text-[hsl(var(--muted-foreground))]">{step.desc}</p>
            </div>
            <step.icon className="w-4 h-4 text-[hsl(var(--muted-foreground))] flex-shrink-0 mt-0.5" />
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-center"
      >
        <Link href="/test"
          className="
            inline-flex items-center gap-2.5 px-6 py-3 rounded-xl
            bg-[hsl(var(--chart-3))] hover:bg-[hsl(var(--chart-3))]
            text-[14px] font-semibold text-white
            transition-colors shadow-lg shadow-blue-500/20
          ">
          <Compass className="w-4 h-4" />
          Inizia il test di orientamento
          <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  );
}
