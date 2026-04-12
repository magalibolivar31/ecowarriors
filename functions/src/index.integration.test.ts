import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  configValue: { gemini: { key: "cfg-key" } } as any,
  onRequest: vi.fn((handler: any) => handler),
  initializeApp: vi.fn(),
  createGeminiModel: vi.fn(),
}));

vi.mock("firebase-functions", () => ({
  https: {
    onRequest: runtimeMocks.onRequest,
  },
  config: () => runtimeMocks.configValue,
}));

vi.mock("firebase-admin", () => ({
  initializeApp: runtimeMocks.initializeApp,
}));

vi.mock("cors", () => ({
  default: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock("./lib/aiClient", () => ({
  createGeminiModel: runtimeMocks.createGeminiModel,
}));

import {
  analyzePollutionImage,
  analyzeReport,
  chatWithRocco,
  generateMissions,
  getRoccoFeedback,
  summarizeFile,
  summarizeNews,
  validateDonation,
  validateRequest,
} from "./index";

function createRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

function mockModelWithText(text: string) {
  const generateContent = vi.fn().mockResolvedValue({
    response: { text: () => text },
  });
  const sendMessage = vi.fn().mockResolvedValue({
    response: { text: () => text },
  });
  const startChat = vi.fn().mockReturnValue({ sendMessage });

  runtimeMocks.createGeminiModel.mockReturnValue({
    generateContent,
    startChat,
  });

  return { generateContent, startChat, sendMessage };
}

describe("functions/index integration", () => {
  beforeEach(() => {
    runtimeMocks.configValue = { gemini: { key: "cfg-key" } };
    runtimeMocks.createGeminiModel.mockReset();
  });

  it("inicializa app y registra handlers HTTP", () => {
    expect(runtimeMocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.onRequest).toHaveBeenCalledTimes(9);
  });

  it("todos los handlers rechazan método distinto de POST", async () => {
    const handlers = [
      analyzeReport,
      chatWithRocco,
      validateDonation,
      validateRequest,
      generateMissions,
      getRoccoFeedback,
      summarizeNews,
      summarizeFile,
      analyzePollutionImage,
    ];

    for (const handler of handlers) {
      const res = createRes();
      await handler({ method: "GET", body: {} } as any, res);
      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.send).toHaveBeenCalledWith("Method Not Allowed");
    }
  });

  it("devuelve 500 cuando no hay API key", async () => {
    runtimeMocks.configValue = {};
    const previousEnv = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const res = createRes();
    await validateRequest({ method: "POST", body: { title: "t", content: "c", tag: "x" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("API Key not configured");

    if (previousEnv) process.env.GEMINI_API_KEY = previousEnv;
  });

  it("analyzeReport parsea JSON y responde 200", async () => {
    mockModelWithText("```json\n{\"ok\":true}\n```");
    const res = createRes();

    await analyzeReport(
      { method: "POST", body: { image: "base64", description: "desc", language: "es" } } as any,
      res
    );

    expect(runtimeMocks.createGeminiModel).toHaveBeenCalledWith("cfg-key");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("validateDonation parsea JSON y responde 200", async () => {
    mockModelWithText("```json\n{\"valid\":true,\"reason\":\"ok\"}\n```");
    const res = createRes();

    await validateDonation(
      { method: "POST", body: { images: ["img"], title: "T", tag: "ropa" } } as any,
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ valid: true, reason: "ok" });
  });

  it("validateRequest parsea JSON y responde 200", async () => {
    mockModelWithText("{\"valid\":true}");
    const res = createRes();

    await validateRequest({ method: "POST", body: { title: "t", content: "c", tag: "x" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ valid: true });
  });

  it("generateMissions parsea array JSON y responde 200", async () => {
    mockModelWithText("[{\"id\":\"m1\",\"title\":\"Misión\",\"description\":\"D\",\"points\":10,\"type\":\"cleanup\"}]");
    const res = createRes();

    await generateMissions({ method: "POST", body: { userContext: "ctx" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      { id: "m1", title: "Misión", description: "D", points: 10, type: "cleanup" },
    ]);
  });

  it("getRoccoFeedback devuelve texto del modelo", async () => {
    mockModelWithText("Seguí así");
    const res = createRes();

    await getRoccoFeedback({ method: "POST", body: { behavior: "limpió plaza" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ text: "Seguí así" });
  });

  it("summarizeNews parsea JSON y responde 200", async () => {
    mockModelWithText("[{\"title\":\"t\",\"summary\":\"s\",\"source\":\"x\",\"isCrisis\":false}]");
    const res = createRes();

    await summarizeNews({ method: "POST", body: { isCrisis: false } } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      { title: "t", summary: "s", source: "x", isCrisis: false },
    ]);
  });

  it("summarizeFile devuelve texto del modelo", async () => {
    mockModelWithText("Resumen de archivo");
    const res = createRes();

    await summarizeFile(
      { method: "POST", body: { base64Data: "abc", mimeType: "image/jpeg" } } as any,
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ text: "Resumen de archivo" });
  });

  it("chatWithRocco responde texto del modelo", async () => {
    const model = mockModelWithText("Respuesta de Rocco");
    const res = createRes();

    await chatWithRocco(
      {
        method: "POST",
        body: {
          systemInstruction: "system",
          messages: [
            { role: "user", content: "Hola" },
            { role: "assistant", content: "¿Cómo estás?" },
            { role: "user", content: "Necesito ayuda" },
          ],
        },
      } as any,
      res
    );

    expect(model.startChat).toHaveBeenCalledTimes(1);
    expect(model.sendMessage).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ text: "Respuesta de Rocco" });
  });

  it("validateRequest devuelve 500 si falla el modelo", async () => {
    const generateContent = vi.fn().mockRejectedValue(new Error("boom"));
    runtimeMocks.createGeminiModel.mockReturnValue({
      generateContent,
      startChat: vi.fn(),
    });
    const res = createRes();

    await validateRequest({ method: "POST", body: { title: "t", content: "c", tag: "x" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Error validating request");
  });

  it("analyzePollutionImage devuelve 500 si falla la generación", async () => {
    const generateContent = vi.fn().mockRejectedValue(new Error("boom"));
    runtimeMocks.createGeminiModel.mockReturnValue({
      generateContent,
      startChat: vi.fn(),
    });
    const res = createRes();

    await analyzePollutionImage({ method: "POST", body: { base64Image: "img" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Error analyzing pollution image");
  });
});
