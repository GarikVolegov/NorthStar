import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_EXPIRED_EVENT, TOKEN_STORAGE_KEY } from "@/lib/storage-keys";
import {
  ApiClientError,
  getJson,
  postJson,
  putJson,
  stream,
} from "./apiClient";
import { setInMemoryToken } from "./api-fetch";

describe("apiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setInMemoryToken(null);
  });

  it("adds auth and parses JSON", async () => {
    setInMemoryToken("abc");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    await expect(getJson<{ ok: boolean }>("/api/test")).resolves.toEqual({
      ok: true,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer abc");
  });

  it("stringifies JSON bodies", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 1 }), { status: 200 }),
      );

    await postJson("/api/test", { name: "Wendy" });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ name: "Wendy" }));
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("sends PUT JSON requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    await putJson("/api/test/1", { name: "Wendy" });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ name: "Wendy" }));
  });

  it("throws typed errors with parsed body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Nope" }), { status: 422 }),
    );

    await expect(getJson("/api/test")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 422,
      message: "Nope",
    } satisfies Partial<ApiClientError>);
  });

  it("explains empty dev proxy 500 responses as a missing local API server", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 500 }),
    );

    let error: unknown;
    try {
      await getJson("/api/test");
    } catch (err) {
      error = err;
    }

    expect(error).toMatchObject({
      name: "ApiClientError",
      status: 500,
    } satisfies Partial<ApiClientError>);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).message).toContain(
      "Avvia il backend NorthStar",
    );
  });

  it("turns network failures into actionable typed API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(getJson("/api/test")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 0,
      message: expect.stringContaining("Server API locale non raggiungibile"),
    } satisfies Partial<ApiClientError>);
  });

  it("dispatches auth-expired when a tokenized request gets 401", async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, "stored");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 401 }),
    );
    const listener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, listener);

    await expect(getJson("/api/me")).rejects.toBeInstanceOf(ApiClientError);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns successful stream responses", async () => {
    const response = new Response("event: done\n\n", { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    await expect(stream("/api/sse")).resolves.toBe(response);
  });
});
