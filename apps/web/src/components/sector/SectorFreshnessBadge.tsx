import { cn } from "@/lib/utils";

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function SectorFreshnessBadge({ updatedAt, className }: { updatedAt?: string | null; className?: string }) {
  const days = daysSince(updatedAt);

  if (days === null) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400", className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Dati non disponibili
      </span>
    );
  }

  if (days <= 30) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400", className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Aggiornato {days}g fa
      </span>
    );
  }

  if (days <= 90) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400", className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        Aggiornato {days}g fa
      </span>
    );
  }

  if (days <= 180) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400", className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
        Aggiornato {days}g fa
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400", className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Dati non aggiornati
    </span>
  );
}
