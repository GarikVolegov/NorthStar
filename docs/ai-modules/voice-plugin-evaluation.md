# Wendy Voice Plugin Evaluation

Wendy's voice layer now supports external providers through the AI Plugin
Protocol. The first external provider is ElevenLabs, while OpenAI remains the
native fallback.

## Initial Choice

ElevenLabs is the first adapter because it gives the most visible UX lift:
more natural voice output without changing Wendy's browser contract.

```env
FF_VOICE_PLUGIN=true
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_WENDY_VOICE_ID=...
```

## Provider Behavior

| Provider | Role | Notes |
| --- | --- | --- |
| ElevenLabs | Optional external voice plugin | Used only when the feature flag and API key are present. Returns MP3 audio. |
| OpenAI | Native fallback | Existing `gpt-4o-mini-tts`/audio path remains available if no external voice plugin is active. |

## Acceptance

- The plugin is not registered unless explicitly enabled.
- `textToSpeech()` and Wendy TTS prefer a non-OpenAI voice plugin when active.
- The OpenAI plugin calls the native OpenAI TTS function directly, avoiding
  registry recursion.
- Frontend audio behavior stays unchanged because the server still returns an
  audio buffer.
