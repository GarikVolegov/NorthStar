/**
 * DashboardAutonomo.tsx — PLACEHOLDER
 * Verrà implementata nel prossimo step.
 */
import { Link } from 'wouter';
import { Zap, ArrowRight } from 'lucide-react';

export default function DashboardAutonomo() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[#0d1421] border border-white/[0.06] flex items-center justify-center">
          <Zap className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#dce6f5]">Autonomo</h1>
          <p className="text-[13px] text-[#7c8db5]">La tua dashboard personalizzata è in arrivo</p>
        </div>
      </div>
      <p className="text-[13px] text-[#4a5a75] mb-6 mt-4">
        Sei freelance o stai costruendo qualcosa di tuo. Presto troverai qui
        il validatore di idee, news di settore e gestione del network.
      </p>
      <Link href="/validatore-idea"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a3a6b] text-[#7eb3ff] text-[13px] font-medium hover:bg-[#1f4480] transition-colors">
        Valida la tua idea <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
