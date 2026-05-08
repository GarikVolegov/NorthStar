/**
 * GrowthProfilePage v2 — aggiunta tab Profilo (Passo 1).
 *
 * CHANGES:
 * - Tab 'profilo' (👤) aggiunta come prima voce nella sidebar e mobile bar
 * - ProfileEditPanel montato nella nuova tab (non rimontato al cambio tab)
 * - Props estese con profileData? per pre-popolare il form
 */
import React, { useState, useEffect, useCallback } from "react";
import { GrowthChatPanel }           from "./GrowthChatPanel";
import { GrowthMemoryPanel }          from "./GrowthMemoryPanel";
import { GrowthAnalyticsDashboard }   from "./GrowthAnalyticsDashboard";
import { ProfileEditPanel }           from "./ProfileEditPanel";
import type { ProfileData }           from "./ProfileEditPanel";

// ── Types ───────────────────────────────────────────────────────────────────

type TabId = "profilo" | "chat" | "memory" | "analytics";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "profilo",   label: "Profilo",   icon: "👤" },
  { id: "chat",      label: "Chat",      icon: "💬" },
  { id: "memory",    label: "Memoria",   icon: "🧠" },
  { id: "analytics", label: "Analytics", icon: "📊" },
];

interface AppNotification {
  id: number; type: string; title: string; body: string; createdAt: string;
}

// ── Sub-components (unchanged from v1) ───────────────────────────────────────

function DigestBanner({ notification, onDismiss }: { notification: AppNotification; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 bg-indigo-600 text-white">
      <span className="text-xl flex-shrink-0 mt-0.5">🌟</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{notification.title}</p>
        <p className="text-xs text-indigo-200 mt-0.5 line-clamp-1">{notification.body}</p>
      </div>
      <button onClick={onDismiss} className="flex-shrink-0 text-indigo-200 hover:text-white transition-colors mt-0.5" aria-label="Chiudi">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function CoachCard({ userName, avatarUrl }: { userName: string; avatarUrl?: string | null }) {
  const initials = userName.split(" ").slice(0,2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div className="flex flex-col items-center py-8 px-4 border-b border-gray-100">
      <div className="relative">
        {avatarUrl ? (
          <img src={avatarUrl} alt={userName} className="w-16 h-16 rounded-2xl object-cover shadow-md" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md">
            <span className="text-white text-xl font-bold">{initials || "N"}</span>
          </div>
        )}
        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full" />
      </div>
      <h2 className="mt-3 text-sm font-semibold text-gray-800">Coach NorthStar</h2>
      <p className="text-xs text-gray-400">Crescita personale</p>
      {userName && (
        <div className="mt-4 w-full px-3 py-2.5 rounded-xl bg-indigo-50 text-center">
          <p className="text-xs text-indigo-500">Sessione di</p>
          <p className="text-sm font-semibold text-indigo-700 truncate">{userName}</p>
        </div>
      )}
    </div>
  );
}

function SidebarNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            }`}>
            <span className="text-base">{tab.icon}</span>
            {tab.label}
            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
          </button>
        );
      })}
    </nav>
  );
}

function MobileTabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <div className="flex border-b border-gray-100 bg-white">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              isActive ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-400 border-b-2 border-transparent"
            }`}>
            <span className="text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface GrowthProfilePageProps {
  token:        string;
  userName?:    string;
  journeyType?: string;
  userMode?:    string;
  objectives?:  string[];
  sectorName?:  string;
  apiBase?:     string;
  className?:   string;
  /** v2: pre-popola ProfileEditPanel senza fetch aggiuntiva */
  profileData?: Partial<ProfileData>;
}

export function GrowthProfilePage({
  token,
  userName = "",
  journeyType = "generico",
  userMode = "esplorativo",
  objectives,
  sectorName,
  apiBase = "/api",
  className = "",
  profileData,
}: GrowthProfilePageProps) {
  const [activeTab,    setActiveTab]    = useState<TabId>("profilo");
  const [notification, setNotification] = useState<AppNotification | null>(null);
  // Track avatar url updates from profile panel so CoachCard updates live
  const [liveAvatarUrl, setLiveAvatarUrl] = useState<string | null | undefined>(
    profileData?.avatarUrl
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/growth-agent/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json() as { notifications: AppNotification[] };
        const digest = data.notifications.find((n) => n.type === "weekly_digest");
        if (digest && !cancelled) setNotification(digest);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [apiBase, token]);

  const dismissNotification = useCallback(async () => {
    if (!notification) return;
    setNotification(null);
    try {
      await fetch(`${apiBase}/growth-agent/notifications/${notification.id}/read`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* silent */ }
  }, [notification, apiBase, token]);

  const userContext  = { name: userName, journeyType, userMode, objectives, sectorName };
  const sharedProps  = { token, apiBase };

  return (
    <div className={`flex flex-col bg-gray-50 ${className}`}>

      {notification && (
        <DigestBanner notification={notification} onDismiss={dismissNotification} />
      )}

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">

        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 bg-white border-r border-gray-100 h-full">
          <CoachCard userName={userName} avatarUrl={liveAvatarUrl} />
          <SidebarNav active={activeTab} onChange={setActiveTab} />
          <div className="mt-auto p-4">
            <div className="rounded-xl bg-indigo-50 px-4 py-3">
              <p className="text-xs text-indigo-600 font-medium">💡 Lo sapevi?</p>
              <p className="text-xs text-indigo-500 mt-1">
                Aggiorna il tuo profilo per ricevere consigli più precisi da Wendy.
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* Mobile tab bar */}
          <div className="lg:hidden">
            <MobileTabBar active={activeTab} onChange={setActiveTab} />
          </div>

          {/* Tab: Profilo (sempre montato, nascosto se non attivo) */}
          <div className={`flex-1 overflow-y-auto p-5 ${
            activeTab === "profilo" ? "block" : "hidden"
          }`}>
            <ProfileEditPanel
              {...sharedProps}
              initialData={{
                name:        userName,
                journeyType: journeyType !== "generico" ? journeyType : undefined,
                userMode:    userMode    !== "esplorativo" ? userMode : undefined,
                ...profileData,
              }}
              onSaved={(saved) => {
                // Update live avatar in CoachCard if changed
                if (saved.avatarUrl !== liveAvatarUrl) setLiveAvatarUrl(saved.avatarUrl);
              }}
            />
          </div>

          {/* Tab: Chat (kept mounted to preserve SSE) */}
          <div className={`flex-1 min-h-0 ${
            activeTab === "chat" ? "flex" : "hidden"
          }`}>
            <GrowthChatPanel
              {...sharedProps}
              userContext={userContext}
              className="flex-1 rounded-none border-0 shadow-none"
            />
          </div>

          {/* Tab: Memory */}
          {activeTab === "memory" && (
            <div className="flex-1 overflow-y-auto p-6">
              <GrowthMemoryPanel {...sharedProps} className="max-w-3xl mx-auto" />
            </div>
          )}

          {/* Tab: Analytics */}
          {activeTab === "analytics" && (
            <div className="flex-1 overflow-y-auto p-6">
              <GrowthAnalyticsDashboard {...sharedProps} className="max-w-4xl mx-auto" />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
