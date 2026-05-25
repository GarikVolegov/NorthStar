# Wendy Vision Plugin Evaluation

The first vision adapter is `vision-gpt4o`, registered through the AI Plugin
Protocol when explicitly enabled.

```env
FF_VISION_PLUGIN=true
AI_INTEGRATIONS_OPENAI_API_KEY=...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
VISION_OPENAI_MODEL=gpt-4o
```

## Scope

The plugin accepts image buffers and optional extracted PDF text, then returns:

- `rawText`: the model response;
- `structured`: parsed JSON when the model returns valid JSON.

This is the foundation for CV/profile analysis. The profile upload UX and
database write flow should remain a separate, confirmed product flow.

## Server Route

NorthStar exposes the first controlled workflow at:

```http
POST /api/profile-vision/analyze-cv
```

Request body:

```json
{
  "fileDataUrl": "data:image/png;base64,...",
  "pdfText": "optional extracted text",
  "apply": false
}
```

With `apply: false`, the route returns a preview patch and does not write to the
database. With `apply: true`, it upserts `cvText` and `cvJson` for the
authenticated user's profile. The route returns `503` when no vision plugin is
registered, so the UI can degrade cleanly.

## Acceptance

- The plugin is not registered unless `FF_VISION_PLUGIN=true`.
- Missing OpenAI credentials disable the plugin without blocking server boot.
- Vision results stay server-side until a route explicitly exposes a safe
  workflow.
- CV profile writes are explicit through `apply: true`; preview is the default.
