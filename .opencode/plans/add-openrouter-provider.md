# Add OpenRouterProvider to LLM client

## File
`packages/ai-server/src/llm/client.ts`

## Cosa aggiungere

### 1. Classe `OpenRouterProvider` (dopo `GroqProvider`)

```typescript
class OpenRouterProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    const baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    const apiKey = process.env.OPENROUTER_API_KEY || "";

    if (!apiKey) {
      console.error("[openrouter] OPENROUTER_API_KEY not configured");
    }

    this.client = new OpenAI({ baseURL, apiKey });
    this.model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  }

  async chat(
    messages: LLMMessage[],
    config: LLMConfig = {},
  ): Promise<AsyncIterable<string>> {
    const stream = await this.client.chat.completions.create({
      model: config.model ?? this.model,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens,
      stream: true,
    });

    return {
      [Symbol.asyncIterator]: async function* () {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        }
      },
    };
  }

  async chatOnce(
    messages: LLMMessage[],
    config: LLMConfig = {},
  ): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: config.model ?? this.model,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 1024,
    });
    return completion.choices?.[0]?.message?.content ?? "";
  }
}
```

### 2. In `getLLM()`, aggiungere caso `"openrouter"`

```typescript
export function getLLM(): LLMProvider {
  const provider = process.env.AI_PROVIDER ?? "openai";
  const groqKey = process.env.GROQ_API_KEY;

  if (provider === "groq" && groqKey) {
    return new GroqProvider();
  }

  if (provider === "openrouter") {
    return new OpenRouterProvider();
  }

  return new OpenAIProvider();
}
```

## Config

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

## Test

Dopo l'implementazione:
1. Avviare server con le env sopra
2. Test: `POST /api/search/route` con body `{ "q": "cerca lavoro" }`
3. Dovrebbe rispondere con intent classification dal modello free
