import { apiFetch } from "@/lib/api-fetch";
import i18n from "i18next";
import { getDynamicTranslation } from "@/lib/dynamic-translation";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type JsonBody =
  | BodyInit
  | Record<string, unknown>
  | unknown[]
  | null
  | undefined;

type ApiClientInit = RequestInit & {
  okStatuses?: readonly number[];
};

function normalizeInit(
  init: ApiClientInit = {},
  body?: JsonBody,
): ApiClientInit {
  if (body === undefined) return init;
  if (body == null || typeof body === "string" || body instanceof FormData) {
    return { ...init, body: body ?? null };
  }
  return { ...init, body: JSON.stringify(body) };
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function dynamicClientMessage(key: string, source: string, context: string): Promise<string> {
  return getDynamicTranslation({
    locale: i18n.language ?? "it",
    source,
    context,
    key,
  });
}

async function errorMessage(status: number, body: unknown): Promise<string> {
  if (body && typeof body === "object") {
    const maybe = body as { error?: unknown; message?: unknown };
    if (typeof maybe.error === "string") return maybe.error;
    if (typeof maybe.message === "string") return maybe.message;
  }
  if (
    import.meta.env.DEV &&
    status >= 500 &&
    (body == null || body === "")
  ) {
    return dynamicClientMessage(
      "api.errors.localServerUnavailable",
      "Server API locale non raggiungibile. Avvia il backend NorthStar su porta 3001 con `pnpm run dev:server` oppure usa `pnpm run dev:all`.",
      "Development API error when Vite proxy cannot reach the local backend",
    );
  }
  return dynamicClientMessage(
    "api.errors.requestFailed",
    `API request failed with status ${status}`,
    "Generic API failure shown to the user",
  );
}

function networkErrorSourceMessage(): string {
  if (import.meta.env.DEV) {
    return "Server API locale non raggiungibile. Avvia il backend NorthStar su porta 3001 con `pnpm run dev:server` oppure usa `pnpm run dev:all`.";
  }
  return "Connessione al server NorthStar non riuscita. Controlla la rete e riprova.";
}

function networkErrorKey(): string {
  return import.meta.env.DEV
    ? "api.errors.localServerUnavailable"
    : "api.errors.networkUnreachable";
}

async function safeApiFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await apiFetch(input, init);
  } catch (error) {
    throw new ApiClientError(await dynamicClientMessage(
      networkErrorKey(),
      networkErrorSourceMessage(),
      "Network failure before an API response is available",
    ), 0, {
      error: "network_unreachable",
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function requestJson<T>(
  input: string,
  init: ApiClientInit = {},
): Promise<T> {
  const { okStatuses, ...requestInit } = init;
  const res = await safeApiFetch(input, requestInit);
  const body = await parseBody(res);
  if (!res.ok && !okStatuses?.includes(res.status)) {
    throw new ApiClientError(await errorMessage(res.status, body), res.status, body);
  }
  return body as T;
}

export function getJson<T>(input: string, init?: ApiClientInit): Promise<T> {
  return requestJson<T>(input, { ...init, method: init?.method ?? "GET" });
}

export function postJson<T>(
  input: string,
  body?: JsonBody,
  init?: ApiClientInit,
): Promise<T> {
  return requestJson<T>(
    input,
    normalizeInit({ ...init, method: "POST" }, body),
  );
}

export function patchJson<T>(
  input: string,
  body?: JsonBody,
  init?: ApiClientInit,
): Promise<T> {
  return requestJson<T>(
    input,
    normalizeInit({ ...init, method: "PATCH" }, body),
  );
}

export function putJson<T>(
  input: string,
  body?: JsonBody,
  init?: ApiClientInit,
): Promise<T> {
  return requestJson<T>(input, normalizeInit({ ...init, method: "PUT" }, body));
}

export function deleteJson<T = unknown>(
  input: string,
  init?: ApiClientInit,
): Promise<T> {
  return requestJson<T>(input, { ...init, method: "DELETE" });
}

export async function stream(
  input: string,
  init?: ApiClientInit,
): Promise<Response> {
  const { okStatuses, ...requestInit } = init ?? {};
  const res = await safeApiFetch(input, requestInit);
  if (!res.ok && !okStatuses?.includes(res.status)) {
    const body = await parseBody(res);
    throw new ApiClientError(await errorMessage(res.status, body), res.status, body);
  }
  return res;
}
