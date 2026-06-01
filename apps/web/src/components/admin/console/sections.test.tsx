import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentsSection } from "./AgentsSection";
import { HomeSection } from "./HomeSection";
import { QualitySection } from "./QualitySection";
import { StatusSection } from "./StatusSection";
import type { AdminOverview, AdminOpsStatus, AgentsOverview, BusinessStatusSnapshot, WendyQualityOverview } from "./types";
import { agentStatusLabel, fmtDuration, fmtPct } from "./utils";

const overview: AdminOverview = {
  generatedAt: "2026-05-20T10:00:00Z",
  health: { status: "attention", label: "Attenzione", reasons: ["Redis lento"], criticalCount: 0, actionItems: 3 },
  queues: { reviewPending: 1, growthPending: 2, totalOpen: 3 },
  errors: { totalCaptured: 4, unique: 2, brokenComponents: ["Admin"], recent: [] },
  agents: { total: 2, critical: 0, degraded: 1, failedRecent: [], health: [] },
  metrics: { users: { total: 10, premium: 2, new30d: 3 }, tests: { total: 8 }, calendar: { upcoming: 5, next24h: 1 } },
  inbox: { unreadMessages: 1, pendingLeads: 2, contactedLeads: 0, totalMessages: 4, totalLeads: 5 },
};

const quality: WendyQualityOverview = {
  generatedAt: "2026-05-20T10:00:00Z",
  days: 7,
  summary: {
    total: 12,
    avgEvalScore: 82,
    avgSupervisorScore: null,
    rewriteRate: 0.1,
    clarificationRate: 0.2,
    toolUsageRate: 0.3,
    rewrites: 1,
    clarifications: 2,
    uiTools: 3,
    avgResponseTimeMs: 1200,
    supervisorRewriteCount: 1,
    avgScoreBeforeRewrite: null,
    avgScoreAfterRewrite: null,
    feedbackTotal: 5,
    negativeFeedback: 1,
    positiveFeedback: 4,
    negativeFeedbackRate: 0.2,
  },
  trends: [],
  domains: [],
  problemConversations: [],
  rewriteReasons: [{ reason: "too vague", count: 2 }],
  alerts: [{ level: "attention", title: "Rewrite alto", message: "Soglia superata", domain: null }],
};

const agents: AgentsOverview = {
  generatedAt: "2026-05-20T10:00:00Z",
  summary: {
    totalRuns: 10,
    totalAgents: 1,
    successRate30d: 90,
    avgDurationMs: 1500,
    failedRuns: 1,
    runningRuns: 0,
    degradedAgents: 1,
    criticalAgents: 0,
    costUsd30d: 1.23,
    totalTokens30d: 1234,
    aiRequests30d: 10,
    aiErrors30d: 1,
  },
  agents: [{
    agentName: "wendy",
    totalCalls30d: 10,
    completed30d: 9,
    running30d: 0,
    errorCount30d: 1,
    errorRate30d: 10,
    successRate30d: 90,
    avgDurationMs: 1500,
    lastRunAt: "2026-05-20T10:00:00Z",
    lastErrorAt: null,
    status: "degraded",
  }],
  recentRuns: [],
  recentErrors: [],
  costs: {
    days: 30,
    estimatedCostUsd: 1.23,
    totalTokens: 1234,
    promptTokens: 1000,
    completionTokens: 234,
    requestCount: 10,
    aiRequestCostUsd: 1.23,
    aiRequestTokens: 1234,
    aiRequestCount: 10,
    aiErrorCount: 1,
    byProvider: [],
  },
  runnablePipelines: [
    {
      key: "news-publishing",
      label: "Ricerca e pubblica notizie",
      description: "Raccoglie, arricchisce e pubblica news reali.",
      endpoint: "/admin/pipelines/news-publishing/run",
      method: "POST",
      risk: "low",
      steps: ["Collector", "Enricher", "News publisher"],
      outputs: ["News pubblicate"],
      requiredConfigKeys: ["OPENAI_API_KEY"],
      reviewPolicy: "auto_publish",
    },
    {
      key: "growth-research-review",
      label: "Ricerca crescita personale",
      description: "Crea bozze growth pending review.",
      endpoint: "/admin/pipelines/growth-research-review/run",
      method: "POST",
      risk: "low",
      steps: ["Web research", "Discovery", "Coda Crescita"],
      outputs: ["Bozze create"],
      requiredConfigKeys: ["TAVILY_API_KEY"],
      reviewPolicy: "requires_review",
    },
    {
      key: "market-refresh",
      label: "Aggiorna lavori e settori",
      description: "Aggiorna offerte e dati settore.",
      endpoint: "/admin/pipelines/market-refresh/run",
      method: "POST",
      risk: "medium",
      steps: ["Job postings", "Sector data"],
      outputs: ["Snapshot aggiornati"],
      requiredConfigKeys: ["ADZUNA_APP_ID", "ADZUNA_API_KEY"],
      reviewPolicy: "data_refresh",
    },
  ],
  advancedRunnableAgents: [{ key: "collector", label: "Collector", description: "Atomic collector", endpoint: "/admin/agents/collect", method: "POST", risk: "medium" }],
  runnableAgents: [{ key: "collector", label: "Collector", description: "Atomic collector", endpoint: "/admin/agents/collect", method: "POST", risk: "medium" }],
};

const ops: AdminOpsStatus = {
  generatedAt: "2026-05-20T10:00:00Z",
  enabled: true,
  confirmationRequired: true,
  compose: { file: "docker-compose.yml", exists: true, dockerError: null, allowedServices: ["northstar-server"] },
  capabilities: { serverStart: true, serverStop: true, serverRestart: true, databaseMaintenance: true, databaseRestart: false },
  server: { status: "online", uptimeSeconds: 3660, pid: 123, nodeVersion: "v20", platform: "linux", env: "test", memory: { rss: 1, heapUsed: 1024 * 1024, heapTotal: 2 }, docker: { status: "running", label: "Server" } },
  database: { status: "online", ready: true, maintenance: { enabled: false, reason: null, updatedAt: "2026-05-20T10:00:00Z", updatedBy: null }, pool: { totalCount: 1, idleCount: 1, waitingCount: 0 }, docker: { status: "running", label: "Postgres" } },
  redis: { docker: { status: "running", label: "Redis" } },
  lastOperation: null,
};

const status: BusinessStatusSnapshot = {
  generatedAt: "2026-05-20T10:00:00Z",
  days: 7,
  business: { users: { total: 10, new7d: 1, new30d: 3, premium: 2, conversionRate: 20 }, tests: { total: 8, recent: 1, recent7d: 1, recent30d: 2, confirmed: 6, completionRate: 75 }, topSectors: [] },
  funnels: { userToTestRate: 80, userToPremiumRate: 20, leadConversionRate: 10 },
  technical: {
    status: "healthy",
    label: "OK",
    reasons: [],
    uptimeSeconds: 3600,
    dbReady: true,
    services: { api: { status: "ok", label: "API", uptimeSeconds: 3600 } },
    errors: { totalCaptured: 0, unique: 0, brokenComponents: [], recent: [] },
    agents: { totalRuns: 10, failedRuns: 1, runningRuns: 0, errorRate: 10, avgDurationMs: 1500, recentFailures: [] },
    ai: { requests: 10, errors: 1, errorRate: 10 },
  },
  env: { total: 2, configured: 2, missingCritical: [], missingOptional: [], items: [] },
  inbox: { messages: { total: 1, unread: 0, open: 0 }, leads: { total: 1, pending: 0, contacted: 1, converted: 0, unread: 0 } },
  actions: [{ label: "Apri status", section: "status", path: "/status", count: 1 }],
};

describe("admin console sections", () => {
  it("renders HomeSection KPIs and navigation actions", () => {
    const onNavigate = vi.fn();
    render(<HomeSection data={overview} loading={false} onRefresh={vi.fn()} onNavigateSection={onNavigate} />);

    expect(screen.getByText("Panoramica Admin")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Azioni aperte"));
    expect(onNavigate).toHaveBeenCalledWith("queue");
  });

  it("renders QualitySection KPIs", () => {
    render(
      <QualitySection
        data={quality}
        loading={false}
        days="7"
        onDaysChange={vi.fn()}
        onRefresh={vi.fn()}
        onOpenStatus={vi.fn()}
      />,
    );

    expect(screen.getByText("Qualita Wendy")).toBeInTheDocument();
    expect(screen.getByText(fmtPct(quality.summary.rewriteRate))).toBeInTheDocument();
    expect(screen.getByText("Rewrite alto")).toBeInTheDocument();
  });

  it("renders AgentsSection overview and launch controls", () => {
    const onTabChange = vi.fn();
    render(
      <AgentsSection
        data={agents}
        loading={false}
        tab="overview"
        onTabChange={onTabChange}
        agentDays="30"
        onAgentDaysChange={vi.fn()}
        agentFilter="all"
        onAgentFilterChange={vi.fn()}
        agentStatusFilter="all"
        onAgentStatusFilterChange={vi.fn()}
        newsSectorInput=""
        onNewsSectorInputChange={vi.fn()}
        agentsRunning={new Set()}
        agentsResult={{}}
        onRefresh={vi.fn()}
        onOpenStatus={vi.fn()}
        onLaunch={vi.fn()}
      />,
    );

    expect(screen.getAllByText(agentStatusLabel("degraded")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(fmtDuration(agents.summary.avgDurationMs)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Pipeline"));
    expect(onTabChange).toHaveBeenCalledWith("launch");
  });

  it("renders compact news provider diagnostics when control room data includes them", () => {
    const withDiagnostics: AgentsOverview = {
      ...agents,
      controlRoom: {
        ai: {
          activeProvider: "openrouter",
          openRouterConfigured: true,
          openAiFallbackConfigured: true,
          model: "gpt-4o-mini",
          status: "configured",
        },
        configBlockers: [],
        readyOutputs: {
          realNews: { count: 12, status: "ready" },
          pendingDiscovery: { count: 1, status: "attention" },
          growthArticles: { count: 3, status: "ready" },
          jobSnapshots: { count: 4, status: "ready" },
        },
        latestRuns: [],
        newsDiagnostics: {
          providerStatus: "degraded",
          lastAttemptAt: "2026-05-20T09:30:00Z",
          enabledSources: 4,
          sourcesWithErrors: 2,
          totalFetched: 37,
          lastRefreshError: "GNews: quota exceeded",
          refreshAction: "check_provider_keys",
          message: "Controlla chiavi provider e rate limit.",
        },
      },
    };

    render(
      <AgentsSection
        data={withDiagnostics}
        loading={false}
        tab="overview"
        onTabChange={vi.fn()}
        agentDays="30"
        onAgentDaysChange={vi.fn()}
        agentFilter="all"
        onAgentFilterChange={vi.fn()}
        agentStatusFilter="all"
        onAgentStatusFilterChange={vi.fn()}
        newsSectorInput=""
        onNewsSectorInputChange={vi.fn()}
        agentsRunning={new Set()}
        agentsResult={{}}
        onRefresh={vi.fn()}
        onOpenStatus={vi.fn()}
        onLaunch={vi.fn()}
      />,
    );

    expect(screen.getByText("Provider news")).toBeInTheDocument();
    expect(screen.getByText("degraded")).toBeInTheDocument();
    expect(screen.getByText("Fonti abilitate")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("37")).toBeInTheDocument();
    expect(screen.getByText("GNews: quota exceeded")).toBeInTheDocument();
    expect(screen.getByText("Controlla chiavi provider e rate limit.")).toBeInTheDocument();
  });

  it("renders pipeline launch cards without exposing atomic agents in the primary view", () => {
    const onLaunch = vi.fn();
    render(
      <AgentsSection
        data={agents}
        loading={false}
        tab="launch"
        onTabChange={vi.fn()}
        agentDays="30"
        onAgentDaysChange={vi.fn()}
        agentFilter="all"
        onAgentFilterChange={vi.fn()}
        agentStatusFilter="all"
        onAgentStatusFilterChange={vi.fn()}
        newsSectorInput=""
        onNewsSectorInputChange={vi.fn()}
        agentsRunning={new Set()}
        agentsResult={{}}
        onRefresh={vi.fn()}
        onOpenStatus={vi.fn()}
        onLaunch={onLaunch}
      />,
    );

    expect(screen.getByText("Ricerca e pubblica notizie")).toBeInTheDocument();
    expect(screen.getByText("Ricerca crescita personale")).toBeInTheDocument();
    expect(screen.getByText("Aggiorna lavori e settori")).toBeInTheDocument();
    expect(screen.queryByText("Atomic collector")).not.toBeInTheDocument();

    const launchButton = screen.getAllByRole("button", { name: /Avvia pipeline/i })[0];
    expect(launchButton).toBeDefined();
    fireEvent.click(launchButton!);
    expect(onLaunch).toHaveBeenCalledWith(
      "news-publishing",
      "/admin/pipelines/news-publishing/run",
      {},
    );
  });

  it("shows running pipeline results as in progress instead of failed", () => {
    render(
      <AgentsSection
        data={agents}
        loading={false}
        tab="launch"
        onTabChange={vi.fn()}
        agentDays="30"
        onAgentDaysChange={vi.fn()}
        agentFilter="all"
        onAgentFilterChange={vi.fn()}
        agentStatusFilter="all"
        onAgentStatusFilterChange={vi.fn()}
        newsSectorInput=""
        onNewsSectorInputChange={vi.fn()}
        agentsRunning={new Set(["news-publishing"])}
        agentsResult={{
          "news-publishing": { ok: false, data: { status: "running..." } },
        }}
        onRefresh={vi.fn()}
        onOpenStatus={vi.fn()}
        onLaunch={vi.fn()}
      />,
    );

    expect(screen.getByText("Pipeline in esecuzione")).toBeInTheDocument();
    expect(screen.queryByText("Run fallita")).not.toBeInTheDocument();
  });

  it("renders news source diagnostics in pipeline results", () => {
    render(
      <AgentsSection
        data={agents}
        loading={false}
        tab="launch"
        onTabChange={vi.fn()}
        agentDays="30"
        onAgentDaysChange={vi.fn()}
        agentFilter="all"
        onAgentFilterChange={vi.fn()}
        agentStatusFilter="all"
        onAgentStatusFilterChange={vi.fn()}
        newsSectorInput=""
        onNewsSectorInputChange={vi.fn()}
        agentsRunning={new Set()}
        agentsResult={{
          "news-publishing": {
            ok: true,
            data: {
              runId: 45,
              checked: 0,
              added: 0,
              sourceDiagnostics: [
                {
                  key: "gnews",
                  label: "GNews",
                  status: "not_configured",
                  collected: 0,
                  action: "Configura GNEWS_API_KEY e rilancia la pipeline.",
                },
              ],
            },
          },
        }}
        onRefresh={vi.fn()}
        onOpenStatus={vi.fn()}
        onLaunch={vi.fn()}
      />,
    );

    expect(screen.getByText("Fonti news")).toBeInTheDocument();
    expect(screen.getByText("GNews")).toBeInTheDocument();
    expect(screen.getByText("Configura GNEWS_API_KEY e rilancia la pipeline.")).toBeInTheDocument();
  });

  it("renders StatusSection operational controls", () => {
    const onMaintenance = vi.fn();
    render(
      <StatusSection
        data={status}
        loading={false}
        opsData={ops}
        opsLoading={false}
        opsActionLoading={null}
        opsError={null}
        onRefresh={vi.fn()}
        onOpsRefresh={vi.fn()}
        onOpsAction={vi.fn()}
        onMaintenanceToggle={onMaintenance}
        onNavigateSection={vi.fn()}
      />,
    );

    expect(screen.getByText("Status & Setup")).toBeInTheDocument();
    expect(screen.getByText("Server")).toBeInTheDocument();
    expect(screen.getByLabelText("Maintenance mode database")).toBeInTheDocument();
  });
});
