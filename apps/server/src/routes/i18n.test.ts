import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const translateDynamicUiStringsMock = vi.hoisted(() => vi.fn());

vi.mock("@workspace/ai-server", () => ({
  translateDynamicUiStrings: translateDynamicUiStringsMock,
}));

import i18nRouter from "./i18n";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/i18n", i18nRouter);
  return instance;
}

describe("i18n route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    translateDynamicUiStringsMock.mockResolvedValue({
      locale: "en",
      items: [
        {
          key: "dashboard.start",
          source: "Avvia test",
          text: "Start test",
          status: "translated",
        },
      ],
    });
  });

  it("translates UI strings through the dynamic translation service", async () => {
    const response = await request(app())
      .post("/api/i18n/translate")
      .send({
        locale: "en",
        items: [{ key: "dashboard.start", source: "Avvia test", context: "CTA" }],
      })
      .expect(200);

    expect(response.body.items[0]).toMatchObject({
      key: "dashboard.start",
      text: "Start test",
      status: "translated",
    });
    expect(translateDynamicUiStringsMock).toHaveBeenCalledWith({
      locale: "en",
      items: [{ key: "dashboard.start", source: "Avvia test", context: "CTA" }],
    });
  });

  it("falls back unsupported locales to Italian before translating", async () => {
    translateDynamicUiStringsMock.mockResolvedValueOnce({
      locale: "it",
      items: [{ source: "Lingua", text: "Lingua", status: "source" }],
    });

    await request(app())
      .post("/api/i18n/translate")
      .send({
        locale: "pt",
        items: [{ source: "Lingua", context: "Navbar" }],
      })
      .expect(200);

    expect(translateDynamicUiStringsMock).toHaveBeenCalledWith({
      locale: "it",
      items: [{ source: "Lingua", context: "Navbar" }],
    });
  });

  it("rejects empty translation batches", async () => {
    const response = await request(app())
      .post("/api/i18n/translate")
      .send({ locale: "en", items: [] })
      .expect(400);

    expect(response.body).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(translateDynamicUiStringsMock).not.toHaveBeenCalled();
  });
});
