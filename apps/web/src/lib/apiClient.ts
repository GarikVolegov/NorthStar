import { apiFetch } from "@/lib/api-fetch";

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

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const maybe = body as { error?: unknown; message?: unknown };
    if (typeof maybe.error === "string") return maybe.error;
    if (typeof maybe.message === "string") return maybe.message;
  }
  return `API request failed with status ${status}`;
}

export async function requestJson<T>(
  input: string,
  init: ApiClientInit = {},
): Promise<T> {
  const { okStatuses, ...requestInit } = init;
  const res = await apiFetch(input, requestInit);
  const body = await parseBody(res);
  if (!res.ok && !okStatuses?.includes(res.status)) {
    throw new ApiClientError(errorMessage(res.status, body), res.status, body);
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
  const res = await apiFetch(input, requestInit);
  if (!res.ok && !okStatuses?.includes(res.status)) {
    const body = await parseBody(res);
    throw new ApiClientError(errorMessage(res.status, body), res.status, body);
  }
  return res;
}
