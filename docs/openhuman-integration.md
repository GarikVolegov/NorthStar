# OpenHuman Integration

NorthStar integrates OpenHuman as an optional external personal-agent bridge.
OpenHuman is installed and run as a separate desktop/core process; NorthStar does
not vendor or import OpenHuman GPL-3.0 source code.

Graphify is integrated separately as a local project knowledge graph. NorthStar
reads generated `graphify-out/graph.json` artifacts and exposes them through
authenticated server routes; it does not run Graphify extraction during user
requests.

## Local Setup

Install the desktop app with WinGet:

```powershell
winget install --id TinyHumansAI.OpenHuman --exact --source winget
```

Then enable the server-side bridge:

```env
OPENHUMAN_ENABLED=true
OPENHUMAN_CORE_RPC_URL=http://localhost:43210/rpc
OPENHUMAN_CORE_TOKEN=
OPENHUMAN_TIMEOUT_MS=8000
```

The exact RPC URL/token must come from the OpenHuman local core once it exposes
or documents the endpoint for the installed build.

Enable Graphify only for local/admin project reasoning:

```env
GRAPHIFY_ENABLED=true
GRAPHIFY_GRAPHS=apps:apps/graphify-out/graph.json,packages:packages/graphify-out/graph.json
GRAPHIFY_QUERY_LIMIT=8
GRAPHIFY_MAX_CONTEXT_CHARS=4000
GRAPHIFY_WENDY_ADMIN_ONLY=true
```

Regenerate the graph artifacts with the local Ollama model already configured
for this workspace:

```powershell
graphify update apps --force --backend ollama --model codex-appv --max-concurrency 1
graphify update packages --force --backend ollama --model codex-appv --max-concurrency 1
```

The generated `graphify-out/` directories stay ignored by Git. Commit only the
NorthStar adapter, route, UI, tests and documentation.

## NorthStar Behavior

- Browser code never receives `OPENHUMAN_CORE_TOKEN`.
- `/api/openhuman/*` routes require authenticated NorthStar users.
- Wendy can also use a semantic memory plugin above the structured
  `coach_memory_facts` tables. The initial implementation supports Mem0 through
  the AI Plugin Protocol and is disabled unless both `FF_SEMANTIC_MEMORY=true`
  and `MEM0_API_KEY` are configured.
- Wendy voice can use ElevenLabs through the same AI Plugin Protocol. It is
  disabled unless both `FF_VOICE_PLUGIN=true` and `ELEVENLABS_API_KEY` are
  configured; OpenAI remains the fallback.
- Wendy enriches prompts with OpenHuman memory only when the bridge is enabled
  and reachable.
- Wendy enriches prompts with Graphify project context only when Graphify is
  enabled and the user is admin, unless `GRAPHIFY_WENDY_ADMIN_ONLY=false`.
- If OpenHuman or Graphify is disabled/down, Wendy continues without blocking.
- Every external item returned through NorthStar is marked with explicit source:
  `source: "openhuman"`, `source: "graphify"` or `source: "semantic-memory"`.

## Semantic Memory Plugin

Structured facts and patterns remain in Postgres and keep their current
authority. Mem0/Zep-style memory is an optional conversational recall layer:
fuller turn context, decisions, preferences and emotional signals that are hard
to model as key/value facts.

```env
FF_SEMANTIC_MEMORY=true
MEM0_API_KEY=...
MEM0_BASE_URL=https://api.mem0.ai/v1
```

When enabled, Wendy stores completed turns in the memory plugin in the
background. Store failures never block the user response. Wendy can recall the
same layer with the `recall_semantic_memory` tool or through prompt context.

## Voice Plugin

The first external voice adapter is ElevenLabs. It replaces Wendy's server-side
text-to-speech only when explicitly enabled, and keeps the existing OpenAI
audio path as fallback.

```env
FF_VOICE_PLUGIN=true
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_WENDY_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

`ELEVENLABS_WENDY_VOICE_ID` is optional and lets Wendy use a different voice
from generic app TTS. If the plugin is unavailable or unhealthy, NorthStar keeps
using OpenAI TTS without changing the frontend contract.

## Verification

- `GET /api/openhuman/status` checks the external OpenHuman bridge.
- `GET /api/graphify/status` checks local graph artifacts.
- `GET /api/graphify/search?q=auth` returns project graph matches for admins.
- `GET /api/admin/plugins` shows `memory-mem0` when `MEM0_API_KEY` is present.
- `GET /api/admin/plugins` shows `voice-elevenlabs` when `FF_VOICE_PLUGIN=true`
  and `ELEVENLABS_API_KEY` is present.
- Wendy prompt enrichment can be verified by enabling both flags locally and
  asking an admin Wendy question about an indexed project concept.
