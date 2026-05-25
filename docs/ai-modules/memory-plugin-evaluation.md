# Wendy Semantic Memory Plugin Evaluation

Wendy keeps structured memory in Postgres through `coach_memory_facts` and
`coach_memory_patterns`. The semantic memory plugin is an additional recall
layer for conversation history, decisions, preferences and context that should
not become rigid facts too early.

## Initial Choice

Mem0 is the first plugin because it can be integrated as a simple server-side
REST adapter without changing Wendy's existing fact memory. The plugin is
optional and guarded by:

```env
FF_SEMANTIC_MEMORY=true
MEM0_API_KEY=...
MEM0_BASE_URL=https://api.mem0.ai/v1
```

## Comparison Criteria

| Provider | Fit | Notes |
| --- | --- | --- |
| Mem0 | First adapter | Simple recall/store shape, low integration overhead, good fit for user-specific chat memory. |
| Zep | Candidate adapter | Good session memory model; should be added as a second plugin once the protocol needs provider switching. |
| Postgres facts | Existing authority | Remains the source for confirmed facts and patterns, not replaced by semantic memory. |

## Acceptance

- Wendy keeps working when no memory plugin is registered.
- Semantic memory store runs in the background and never blocks the SSE response.
- Recalled items are marked as `source: "semantic-memory"`.
- Admin plugin health shows the memory provider only when configured.
