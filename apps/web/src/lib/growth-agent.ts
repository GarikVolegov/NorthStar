/**
 * Re-export del pacchetto growth-agent per apps/web.
 *
 * Usare sempre questo file come punto di import, mai i path profondi:
 *   ✅ import { GrowthChatPanel } from "../lib/growth-agent";
 *   ❌ import { GrowthChatPanel } from "../../lib/integrations-openai-ai-react/src/growth-agent/GrowthChatPanel";
 *
 * Così se cambia la struttura interna del pacchetto basta aggiornare
 * solo questo file, non tutti i componenti del frontend.
 */
export * from "../../../lib/integrations-openai-ai-react/src/growth-agent/index";
