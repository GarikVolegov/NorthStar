/**
 * E2E tests for Wendy/Coach API endpoints
 * Tests session CRUD, message streaming, and memory persistence
 */
import { test, expect } from "@playwright/test";
import { loginAsTestUser, TEST_API_URL } from "./helpers/auth";

test.describe("Wendy Coach API", () => {
  let headers: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    headers = await loginAsTestUser(request);
  });

  test("POST /api/coach/sessions — creates a new session", async ({ request }) => {
    const res = await request.post(`${TEST_API_URL}/api/coach/sessions`, {
      headers,
      data: {
        title: "Test E2E",
        firstMessage: "Ciao, sono un test",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.title).toBe("Test E2E");
    expect(body.messages).toHaveLength(1);
  });

  test("GET /api/coach/sessions — lists user sessions", async ({ request }) => {
    const res = await request.get(`${TEST_API_URL}/api/coach/sessions`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("POST /api/coach/sessions/:id/ask — streams SSE response", async ({ request }) => {
    // Create session first
    const createRes = await request.post(`${TEST_API_URL}/api/coach/sessions`, {
      headers,
      data: { title: "Test SSE", firstMessage: "Chi sei?" },
    });
    const session = await createRes.json();

    // Ask
    const askRes = await request.post(`${TEST_API_URL}/api/coach/sessions/${session.id}/ask`, {
      headers,
      data: { message: "Cosa puoi fare per me?" },
    });
    expect(askRes.status()).toBe(200);

    const text = await askRes.text();
    expect(text).toContain("data:");
    expect(text).toContain("token");
  });

  test("DELETE /api/coach/sessions/:id — deletes session", async ({ request }) => {
    const createRes = await request.post(`${TEST_API_URL}/api/coach/sessions`, {
      headers,
      data: { title: "Da cancellare" },
    });
    const session = await createRes.json();

    const delRes = await request.delete(
      `${TEST_API_URL}/api/coach/sessions/${session.id}`,
      { headers },
    );
    expect(delRes.status()).toBe(204);
  });

  test("POST /api/ai/wendy — small talk locale risponde via SSE senza pipeline completa", async ({ request }) => {
    const res = await request.post(`${TEST_API_URL}/api/ai/wendy`, {
      headers,
      data: { message: "come stai?" },
    });
    expect(res.status()).toBe(200);

    const text = await res.text();
    expect(text).toContain('"type":"token"');
    expect(text).toContain("local-wendy-reply");
    expect(text).not.toContain('"type":"error"');
  });

  test("POST /api/wendy/ask — RAG streaming endpoint", async ({ request }) => {
    const res = await request.post(`${TEST_API_URL}/api/wendy/ask`, {
      headers,
      data: { message: "Parlami del settore tecnologico" },
    });
    expect(res.status()).toBe(200);

    const text = await res.text();
    expect(text).toContain("data:");
    expect(text).toContain("sources");
    expect(text).toContain("token");
  });
});
