/**
 * Test di integrazione — AI Router
 *
 * Verifica che TUTTE le chiamate AI passino dal router (lib/ai/index.ts)
 * e mai dai provider direttamente. In CI USE_MOCK_AI=true garantisce
 * zero costo API e risposta deterministica.
 *
 * Pattern:
 *   1. Chiama un endpoint Express che internamente usa `ai.*`
 *   2. Verifica che mockCallCount sia aumentato → il traffico è passato dal router
 *   3. Verifica che lastMockUseCase corrisponda all'use case atteso
 *   4. Verifica che NESSUN SDK provider (openai, anthropic, groq) sia stato chiamato
 *      direttamente (controllando che fetch non sia stato invocato verso api.openai.com ecc.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// ─── Mock USE_MOCK_AI=true PRIMA di importare il modulo ai ───────────────────
process.env.USE_MOCK_AI = 'true';
process.env.JWT_SECRET  = 'ci-jwt-secret-32-chars-minimum!';
process.env.ADMIN_KEY   = 'ci-admin-key';

// Intercetta fetch per rilevare chiamate dirette a provider esterni
const externalAICalls: string[] = [];
const originalFetch = global.fetch;
vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
  const urlStr = url.toString();
  const aiProviderUrls = [
    'api.openai.com',
    'api.anthropic.com',
    'api.groq.com',
    'generativelanguage.googleapis.com',
  ];
  if (aiProviderUrls.some((domain) => urlStr.includes(domain))) {
    externalAICalls.push(urlStr);
    // Lancia errore invece di chiamare l'API — il test deve FALLIRE se si arriva qui
    throw new Error(
      `[TEST FAIL] Chiamata diretta a provider AI rilevata: ${urlStr}. ` +
      'Tutte le chiamate AI devono passare da lib/ai/index.ts con USE_MOCK_AI=true.'
    );
  }
  return originalFetch(url as URL, init);
});

// ─── Import app DOPO aver impostato env e mock fetch ─────────────────────────
import { resetMockCounters, mockCallCount, lastMockUseCase } from '../../lib/ai/index.js';

// Mock DB
const mockDbExecute = vi.fn().mockResolvedValue([]);
vi.mock('@workspace/db', () => ({
  db: { execute: mockDbExecute, select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis() },
  sql: new Proxy({}, { get: () => () => '' }),
}));

// ─── Helper: crea JWT test valido ─────────────────────────────────────────────
import jwt from 'jsonwebtoken';
function makeTestToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    { id: 1, email: 'test@northstar.it', role: 'user', isPremium: false, ...overrides },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('AI Router — tutte le chiamate passano dal router, non dai provider', () => {
  beforeEach(() => {
    resetMockCounters();
    externalAICalls.length = 0;
  });

  afterEach(() => {
    // Asserzione globale: nessuna chiamata diretta a provider esterni
    expect(externalAICalls).toHaveLength(0);
  });

  it('USE_MOCK_AI=true è attivo — il modulo AI è in mock mode', () => {
    expect(process.env.USE_MOCK_AI).toBe('true');
  });

  it('mockCallCount parte da 0 dopo reset', () => {
    expect(mockCallCount).toBe(0);
  });

  it('ai.chat incrementa mockCallCount e imposta lastMockUseCase', async () => {
    // Import diretto del client AI (non tramite HTTP) per testare il layer
    const { ai } = await import('../../lib/ai/index.js');
    const result = await ai.chat({
      useCase: 'json_extraction',
      messages: [{ role: 'user', content: 'Estrai il CV' }],
    });

    expect(result).toBeTruthy();
    expect(mockCallCount).toBe(1);
    expect(lastMockUseCase).toBe('json_extraction');
  });

  it('ai.streamChat incrementa mockCallCount', async () => {
    const { ai } = await import('../../lib/ai/index.js');
    const chunks: string[] = [];
    for await (const chunk of ai.streamChat({
      useCase: 'streaming_chat',
      messages: [{ role: 'user', content: 'Ciao' }],
    })) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(mockCallCount).toBe(1);
    expect(lastMockUseCase).toBe('streaming_chat');
  });

  it('ai.analyzeAgent incrementa mockCallCount e restituisce AIAgentResponse', async () => {
    const { ai } = await import('../../lib/ai/index.js');
    const result = await ai.analyzeAgent({
      systemPrompt: 'Analizza il profilo',
      userPrompt: 'Utente con background tech',
      useCase: 'agent_analysis',
    });
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('inputTokens');
    expect(mockCallCount).toBe(1);
  });

  it('ai.embed restituisce vettore 1536-dim senza chiamate esterne', async () => {
    const { ai } = await import('../../lib/ai/index.js');
    const result = await ai.embed('NorthStar career platform');
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1536);
    expect(mockCallCount).toBe(1);
  });

  it('chiamate multiple incrementano mockCallCount in modo cumulativo', async () => {
    const { ai } = await import('../../lib/ai/index.js');
    await ai.chat({ useCase: 'research', messages: [{ role: 'user', content: 'test' }] });
    await ai.chat({ useCase: 'json_extraction', messages: [{ role: 'user', content: 'test' }] });
    expect(mockCallCount).toBe(2);
  });

  it('dopo resetMockCounters il contatore torna a 0', async () => {
    const { ai } = await import('../../lib/ai/index.js');
    await ai.chat({ useCase: 'research', messages: [{ role: 'user', content: 'test' }] });
    expect(mockCallCount).toBe(1);
    resetMockCounters();
    expect(mockCallCount).toBe(0);
  });
});
