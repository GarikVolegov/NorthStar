/**
 * GrowthProfilePage — unified coach profile page.
 *
 * LAYOUT (desktop)
 * ────────────────
 *
 *  ┌────────────────────┬────────────────────────────────────┐
 *  │ Sidebar (w-80)    │  Main content area              │
 *  │                   │                                 │
 *  │ Coach card:       │  [active tab content]            │
 *  │  · Avatar         │                                 │
 *  │  · Name           │  💬  GrowthChatPanel           │
 *  │  · Online dot     │  🧠  GrowthMemoryPanel         │
 *  │  · Session count  │  📊  GrowthAnalyticsDashboard  │
 *  │                   │                                 │
 *  │ Tab nav:          │                                 │
 *  │  · Chat           │                                 │
 *  │  · Memoria        │                                 │
 *  │  · Analytics      │                                 │
 *  └────────────────────┴────────────────────────────────────┘
 *
 * LAYOUT (mobile)
 * ────────────────
 *  Top bar: coach card condensed + tab icons
 *  Content: active tab full-width below
 *
 * USAGE
 * ──────
 *  // In your router (React Router, Next.js page, etc.)
 *  import { GrowthProfilePage } from "@workspace/integrations-openai-ai-react";
 *
 *  export default function CoachPage() {
 *    const jwt = useAuthToken();   // your auth hook
 *    return (
 *      <GrowthProfilePage
 *        token={jwt}
 *        userName="Luca"
 *        journeyType="autonomo"
 *        userMode="esplorativo"
 *        className="h-screen"
 *      />
 *    );
 *  }
 */
import React, { useState } from "react";
import { GrowthChatPanel }           from "./GrowthChatPanel";
import { GrowthMemoryPanel }          from "./GrowthMemoryPanel";
import { GrowthAnalyticsDashboard }   from "./GrowthAnalyticsDashboard";

// ── Tab definitions ─────────────────────────────────────────────────────────────

type TabId = "chat" | "memory" | "analytics";

const TABS: Array<{ id: TabId; label: string; icon: string; mobileIcon: string }> = [
  { id: "chat",      label: "Chat",      icon: "💬", mobileIcon: "💬" },
  { id: "memory",    label: "Memoria",   icon: "🧠", mobileIcon: "🧠" },
  { id: "analytics", label: "Analytics", icon: "📊", mobileIcon: "📊" },
];

// ── Sidebar Coach Card ─────────────────────────────────────────────────────────

function CoachCard({ userName }: { userName: string }) {
  return (
    <div className="flex flex-col items-center py-8 px-4 border-b border-gray-100">
      {/* Avatar */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md">
          <span className="text-white text-xl font-bold">N</span>
        </div>
        {/* Online dot */}
        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full" />
      </div>

      <h2 className="mt-3 text-sm font-semibold text-gray-800">Coach NorthStar</h2>
      <p className="text-xs text-gray-400">Crescita personale</p>

      {/* User greeting */}
      {userName && (
        <div className="mt-4 w-full px-3 py-2.5 rounded-xl bg-indigo-50 text-center">
          <p className="text-xs text-indigo-500">Sessione di</p>
          <p className="text-sm font-semibold text-indigo-700 truncate">{userName}</p>
        </div>
      )}
    </div>
  );
}

// ── Sidebar Tab Nav ───────────────────────────────────────────────────────────

function SidebarNav({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            {tab.label}
            {isActive && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ── Mobile Tab Bar ────────────────────────────────────────────────────────────

function MobileTabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  return (
    <div className="flex border-b border-gray-100 bg-white">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              isActive
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-400 border-b-2 border-transparent"
            }`}
          >
            <span className="text-lg">{tab.mobileIcon}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export interface GrowthProfilePageProps {
  token: string;
  userName?: string;
  journeyType?: string;
  userMode?: string;
  objectives?: string[];
  sectorName?: string;
  apiBase?: string;
  /** Extra Tailwind classes on the root element */
  className?: string;
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
}: GrowthProfilePageProps) {
  const [activeTab, setActiveTab] = useState<TabId>("chat");

  const userContext = { name: userName, journeyType, userMode, objectives, sectorName };
  const sharedProps  = { token, apiBase };

  return (
    <div className={`flex flex-col lg:flex-row bg-gray-50 ${className}`}>

      {/* ───── SIDEBAR (desktop only) ────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 bg-white border-r border-gray-100 h-full">
        <CoachCard userName={userName} />
        <SidebarNav active={activeTab} onChange={setActiveTab} />

        {/* Bottom hint */}
        <div className="mt-auto p-4">
          <div className="rounded-xl bg-indigo-50 px-4 py-3">
            <p className="text-xs text-indigo-600 font-medium">💡 Lo sapevi?</p>
            <p className="text-xs text-indigo-500 mt-1">
              Il coach ricorda le tue sessioni precedenti e adatta le risposte nel tempo.
            </p>
          </div>
        </div>
      </aside>

      {/* ───── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Mobile tab bar */}
        <div className="lg:hidden">
          <MobileTabBar active={activeTab} onChange={setActiveTab} />
        </div>

        {/* ── TAB: CHAT ──────────────────────────────────────────────────── */}
        {/* Keep mounted to preserve SSE state when switching tabs */}
        <div
          className={`flex-1 min-h-0 ${
            activeTab === "chat" ? "flex" : "hidden"
          }`}
        >
          <GrowthChatPanel
            {...sharedProps}
            userContext={userContext}
            className="flex-1 rounded-none border-0 shadow-none"
          />
        </div>

        {/* ── TAB: MEMORY ────────────────────────────────────────────────── */}
        {activeTab === "memory" && (
          <div className="flex-1 overflow-y-auto p-6">
            <GrowthMemoryPanel
              {...sharedProps}
              className="max-w-3xl mx-auto"
            />
          </div>
        )}

        {/* ── TAB: ANALYTICS ─────────────────────────────────────────────── */}
        {activeTab === "analytics" && (
          <div className="flex-1 overflow-y-auto p-6">
            <GrowthAnalyticsDashboard
              {...sharedProps}
              className="max-w-4xl mx-auto"
            />
          </div>
        )}

      </main>
    </div>
  );
}
