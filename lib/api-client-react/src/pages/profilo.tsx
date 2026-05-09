/**
 * profilo.tsx — Pagina /profilo e /profilo/:id
 *
 * Se :id è assente → mostra il profilo dell'utente autenticato (isOwner view).
 * Se :id è presente → carica il profilo pubblico dell'utente con quell'id.
 *
 * Layout:
 *   ─ Hero card: avatar + nome + settore + XP + badge di percorso
 *   ─ Pulsante azione connessione (dinamico per status)
 *   ─ Bio (se presente)
 *   ─ Stats strip: connessioni · badge · membro da
 *   ─ Griglia badge (ultimi 6)
 *   ─ CTA LinkedIn (se presente)
 *
 * Il profilo del proprietario mostra un pulsante "Modifica profilo"
 * al posto dei controlli di connessione.
 */
import { useEffect } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  Users, Zap, Award, Calendar, Linkedin,
  UserPlus, UserCheck, UserX, Clock,
  ChevronLeft, Edit2, Lock, AlertCircle, Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePublicProfile } from '@/hooks/usePublicProfile';

// ── Helpers ────────────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl, size = 'lg' }: {
  name: string;
  avatarUrl: string | null;
  size?: 'lg' | 'xl';
}) {
  const dim = size === 'xl' ? 'w-20 h-20 text-2xl' : 'w-16 h-16 text-xl';
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={80}
        height={80}
        loading="lazy"
        className={`${dim} rounded-full object-cover ring-4 ring-white/10 flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-[#1a2d4f] flex items-center justify-center flex-shrink-0 ring-4 ring-white/10`}>
      <span className="font-bold text-[#7eb3ff]">{initials}</span>
    </div>
  );
}

const journeyLabels: Record<string, { label: string; color: string }> = {
  indeciso:       { label: 'In esplorazione',  color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  in_transizione: { label: 'In transizione',   color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  in_crescita:    { label: 'In crescita',       color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  autonomo:       { label: 'Autonomo',          color: 'text-violet-400 bg-violet-400/10 border-violet-400/20' },
};

function JourneyBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const b = journeyLabels[type] ?? { label: type, color: 'text-[#7c8db5] bg-white/5 border-white/10' };
  return (
    <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full border ${b.color}`}>
      {b.label}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-[#1e2c42]" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-40 bg-[#1e2c42] rounded" />
          <div className="h-3.5 w-28 bg-[#1e2c42] rounded" />
          <div className="h-7 w-24 bg-[#1e2c42] rounded-full" />
        </div>
      </div>
      <div className="h-10 w-full bg-[#1e2c42] rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        {[0,1,2].map((i) => <div key={i} className="h-16 bg-[#1e2c42] rounded-xl" />)}
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-full bg-[#1e2c42] rounded" />
        <div className="h-3.5 w-4/5 bg-[#1e2c42] rounded" />
      </div>
    </div>
  );
}

// ── Pulsante azione connessione ───────────────────────────────────────────

function ConnectionButton({
  status,
  pending,
  onSend,
  onCancel,
  onAccept,
  onRemove,
}: {
  status: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  pending: boolean;
  onSend: () => void;
  onCancel: () => void;
  onAccept: () => void;
  onRemove: () => void;
}) {
  const spin = <Loader2 className="w-4 h-4 animate-spin" />;

  if (status === 'none') return (
    <button
      onClick={onSend}
      disabled={pending}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                 bg-[#1a3a6b] text-[#7eb3ff] hover:bg-[#1f4480] transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
    >
      {pending ? spin : <UserPlus className="w-4 h-4" />}
      Connetti
    </button>
  );

  if (status === 'pending_sent') return (
    <div className="flex gap-2">
      <span className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm
                       font-medium text-[#7c8db5] bg-[#0d1421] border border-white/[0.08]">
        <Clock className="w-4 h-4" />
        Richiesta inviata
      </span>
      <button
        onClick={onCancel}
        disabled={pending}
        aria-label="Annulla richiesta"
        className="px-3 py-2.5 rounded-xl text-sm text-[#7c8db5] border border-white/[0.08]
                   hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/20 transition-colors
                   disabled:opacity-50"
      >
        {pending ? spin : <UserX className="w-4 h-4" />}
      </button>
    </div>
  );

  if (status === 'pending_received') return (
    <div className="flex gap-2">
      <button
        onClick={onAccept}
        disabled={pending}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                   text-sm font-semibold text-white bg-[#1a3a6b] hover:bg-[#1f4480]
                   transition-colors disabled:opacity-50"
      >
        {pending ? spin : <UserCheck className="w-4 h-4" />}
        Accetta richiesta
      </button>
      <button
        onClick={onCancel}
        disabled={pending}
        aria-label="Rifiuta richiesta"
        className="px-3 py-2.5 rounded-xl text-sm text-[#7c8db5] border border-white/[0.08]
                   hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/20 transition-colors
                   disabled:opacity-50"
      >
        {pending ? spin : <UserX className="w-4 h-4" />}
      </button>
    </div>
  );

  // accepted
  return (
    <div className="flex gap-2">
      <span className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm
                       font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
        <UserCheck className="w-4 h-4" />
        Connesso
      </span>
      <button
        onClick={onRemove}
        disabled={pending}
        aria-label="Rimuovi connessione"
        className="px-3 py-2.5 rounded-xl text-sm text-[#7c8db5] border border-white/[0.08]
                   hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/20 transition-colors
                   disabled:opacity-50"
      >
        {pending ? spin : <UserX className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Stat pill ────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 rounded-xl bg-[#0d1421] border border-white/[0.06]">
      <Icon className="w-4 h-4 text-[#4a6fa1]" />
      <span className="text-[18px] font-bold text-[#dce6f5] tabular-nums">{value}</span>
      <span className="text-[11px] text-[#7c8db5]">{label}</span>
    </div>
  );
}

// ── Badge card ────────────────────────────────────────────────────────────

function BadgeCard({ badge }: { badge: {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  earnedAt: string;
}}) {
  return (
    <div
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#0d1421]
                 border border-white/[0.06] text-center"
      title={badge.description ?? badge.name}
    >
      <span className="text-2xl" role="img" aria-label={badge.name}>
        {badge.icon ?? '🏅'}
      </span>
      <span className="text-[11px] font-medium text-[#7c8db5] leading-tight line-clamp-2">
        {badge.name}
      </span>
    </div>
  );
}

// ── Pagina principale ─────────────────────────────────────────────────────

export default function ProfilePage() {
  const params   = useParams<{ id?: string }>();
  const [location, navigate] = useLocation();
  const { user: me } = useAuth();

  // Se non c'è :id, usiamo l'id dell'utente loggato
  const targetId: number | null = params.id
    ? (isNaN(parseInt(params.id, 10)) ? null : parseInt(params.id, 10))
    : (me?.id ?? null);

  // Redirect /profilo → /profilo/:myId quando me è disponibile e non c'è :id
  useEffect(() => {
    if (!params.id && me?.id) {
      navigate(`/profilo/${me.id}`, { replace: true });
    }
  }, [params.id, me?.id, navigate]);

  const { loading, error, profile, actionPending, actions } = usePublicProfile(targetId);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return <ProfileSkeleton />;

  // ── Errori ──────────────────────────────────────────────────────────────
  if (error) {
    const isPrivate = error.code === 403;
    return (
      <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#1e2333] flex items-center justify-center">
          {isPrivate
            ? <Lock className="w-6 h-6 text-[#4a6fa1]" />
            : <AlertCircle className="w-6 h-6 text-[#7c8db5]" />
          }
        </div>
        <h2 className="text-[17px] font-semibold text-[#dce6f5]">
          {isPrivate ? 'Profilo privato' : 'Profilo non trovato'}
        </h2>
        <p className="text-[13px] text-[#7c8db5] max-w-[26ch]">
          {isPrivate
            ? 'Questo utente ha scelto di mantenere il profilo privato.'
            : error.message
          }
        </p>
        <Link
          href="/amici"
          className="mt-2 px-4 py-2 rounded-lg bg-[#1a3a6b] text-[#7eb3ff] text-sm font-medium
                     hover:bg-[#1f4480] transition-colors"
        >
          Torna al Network
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  const { user, stats, badges, connectionStatus, friendshipId } = profile;

  const memberSince = new Date(user.memberSince).toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-xl mx-auto px-4 py-8 space-y-6"
    >
      {/* ── Back link ──────────────────────────────────────────────────── */}
      <Link
        href="/amici"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#7c8db5]
                   hover:text-[#a8b8d0] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Network
      </Link>

      {/* ── Hero card ──────────────────────────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-[#0d1421] border border-white/[0.06] space-y-5">

        {/* Avatar + nome + settore */}
        <div className="flex items-start gap-4">
          <Avatar name={user.name} avatarUrl={user.avatarUrl} size="xl" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#dce6f5] leading-tight">{user.name}</h1>
            {user.sectorName && (
              <p className="text-[13px] text-[#7c8db5] mt-0.5">{user.sectorName}</p>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <JourneyBadge type={user.journeyType} />
              {user.totalXp != null && (
                <span className="flex items-center gap-1 text-[12px] text-amber-400">
                  <Zap className="w-3.5 h-3.5" />
                  {user.totalXp.toLocaleString('it-IT')} XP
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CTA connessione / modifica */}
        {user.isOwner ? (
          <Link
            href="/profilo"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl
                       text-sm font-medium text-[#7c8db5] border border-white/[0.08]
                       hover:bg-white/[0.03] transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Modifica profilo
          </Link>
        ) : (
          <ConnectionButton
            status={connectionStatus}
            pending={actionPending}
            onSend={actions.sendRequest}
            onCancel={actions.cancelRequest}
            onAccept={actions.acceptRequest}
            onRemove={actions.removeConnection}
          />
        )}

        {/* Bio */}
        {user.bio && (
          <p className="text-[13px] text-[#a8b8d0] leading-relaxed border-t border-white/[0.06] pt-4">
            {user.bio}
          </p>
        )}
      </div>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill icon={Users}    label="Connessioni" value={stats.friendCount} />
        <StatPill icon={Award}    label="Badge"       value={stats.badgeCount} />
        <StatPill icon={Calendar} label="Membro da"   value={memberSince} />
      </div>

      {/* ── Badge ──────────────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold text-[#7c8db5] uppercase tracking-wider mb-3">
            Badge
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {badges.map((b) => (
              <BadgeCard key={b.id} badge={b} />
            ))}
          </div>
        </section>
      )}

      {/* ── LinkedIn ───────────────────────────────────────────────────── */}
      {user.linkedinUrl && (
        <a
          href={user.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl
                     text-sm font-medium text-[#7eb3ff] border border-[#1a3a6b]/60
                     hover:bg-[#1a3a6b]/30 transition-colors"
        >
          <Linkedin className="w-4 h-4" />
          Vedi profilo LinkedIn
        </a>
      )}
    </motion.div>
  );
}
