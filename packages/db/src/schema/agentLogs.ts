/**
 * DEPRECATED — this file now re-exports from agentReview.ts.
 *
 * agentLogsTable and agentRunsTable were nearly identical (both tracked
 * agent executions with agentName, userId, durationMs, error).  Keeping
 * two separate tables caused duplicated writes and confused queries.
 *
 * Migration plan:
 *  1. Run: INSERT INTO agent_runs SELECT ... FROM agent_logs  (backfill)
 *  2. Update all import sites to use agentRunsTable from agentReview.ts
 *  3. DROP TABLE agent_logs after confirming no active consumers
 *
 * For now we keep the export alias to avoid breaking existing imports.
 */
export {
  agentRunsTable as agentLogsTable,
  type AgentRun as AgentLog,
  type InsertAgentRun as InsertAgentLog,
} from "./agentReview";
