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

function mockModelWithGenerateError(message = "boom") {
  const generateContent = vi.fn().mockRejectedValue(new Error(message));
  runtimeMocks.createGeminiModel.mockReturnValue({
    generateContent,
    startChat: vi.fn(),
  });
}

function mockModelWithChatError(message = "boom") {
  const sendMessage = vi.fn().mockRejectedValue(new Error(message));
  const startChat = vi.fn().mockReturnValue({ sendMessage });
  runtimeMocks.createGeminiModel.mockReturnValue({
    generateContent: vi.fn(),
    startChat,
  });
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
    const model = mockModelWithText("```json\n{\"ok\":true}\n```");
    const res = createRes();

    await analyzeReport(
      { method: "POST", body: { image: "base64", description: "desc", language: "es" } } as any,
      res
    );

    expect(runtimeMocks.createGeminiModel).toHaveBeenCalledWith("cfg-key");
    expect(model.generateContent).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("analyzeReport usa prompt en inglés cuando language no es es", async () => {
    const model = mockModelWithText("{\"ok\":true}");
    const res = createRes();

    await analyzeReport(
      { method: "POST", body: { image: "base64", description: "desc", language: "en" } } as any,
      res
    );

    const promptPayload = model.generateContent.mock.calls[0]?.[0] as any[];
    expect(promptPayload[0]).toContain("Analyze this image and description of an environmental problem");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("validateDonation parsea JSON y responde 200", async () => {
    const model = mockModelWithText("```json\n{\"valid\":true,\"reason\":\"ok\"}\n```");
    const res = createRes();

    await validateDonation(
      {
        method: "POST",
        body: {
          images: ["data:image/jpeg;base64,img-encoded", "img-raw"],
          title: "T",
          tag: "ropa",
        },
      } as any,
      res
    );

    const donationPayload = model.generateContent.mock.calls[0]?.[0] as any[];
    expect(donationPayload[1]).toEqual({
      inlineData: { data: "img-encoded", mimeType: "image/jpeg" },
    });
    expect(donationPayload[2]).toEqual({
      inlineData: { data: "img-raw", mimeType: "image/jpeg" },
    });
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
    const model = mockModelWithText("Resumen de archivo");
    const res = createRes();

    await summarizeFile(
      { method: "POST", body: { base64Data: "data:image/jpeg;base64,abc", mimeType: "image/jpeg" } } as any,
      res
    );

    const summarizePayload = model.generateContent.mock.calls[0]?.[0] as any[];
    expect(summarizePayload[0]).toEqual({
      inlineData: { data: "abc", mimeType: "image/jpeg" },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ text: "Resumen de archivo" });
  });

  it("analyzePollutionImage parsea JSON y responde 200", async () => {
    const model = mockModelWithText("{\"urgency\":3}");
    const res = createRes();

    await analyzePollutionImage(
      { method: "POST", body: { base64Image: "data:image/jpeg;base64,img" } } as any,
      res
    );

    const pollutionPayload = model.generateContent.mock.calls[0]?.[0] as any[];
    expect(pollutionPayload[0]).toEqual({
      inlineData: { data: "img", mimeType: "image/jpeg" },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ urgency: 3 });
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

  it("chatWithRocco devuelve 500 si falla sendMessage", async () => {
    mockModelWithChatError();
    const res = createRes();

    await chatWithRocco(
      {
        method: "POST",
        body: {
          systemInstruction: "system",
          messages: [
            { role: "assistant", content: "Hola" },
            { role: "user", content: "Necesito ayuda" },
          ],
        },
      } as any,
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Error in Rocco chat");
  });

  const failingGenerateContentCases = [
    {
      name: "analyzeReport",
      handler: analyzeReport,
      body: { image: "base64", description: "desc", language: "es" },
      expectedMessage: "Error analyzing report",
    },
    {
      name: "validateDonation",
      handler: validateDonation,
      body: { images: ["img"], title: "T", tag: "ropa" },
      expectedMessage: "Error validating donation",
    },
    {
      name: "validateRequest",
      handler: validateRequest,
      body: { title: "t", content: "c", tag: "x" },
      expectedMessage: "Error validating request",
    },
    {
      name: "generateMissions",
      handler: generateMissions,
      body: { userContext: "ctx" },
      expectedMessage: "Error generating missions",
    },
    {
      name: "getRoccoFeedback",
      handler: getRoccoFeedback,
      body: { behavior: "limpió plaza" },
      expectedMessage: "Error getting Rocco feedback",
    },
    {
      name: "summarizeNews",
      handler: summarizeNews,
      body: { isCrisis: false },
      expectedMessage: "Error summarizing news",
    },
    {
      name: "summarizeFile",
      handler: summarizeFile,
      body: { base64Data: "abc", mimeType: "image/jpeg" },
      expectedMessage: "Error summarizing file",
    },
    {
      name: "analyzePollutionImage",
      handler: analyzePollutionImage,
      body: { base64Image: "img" },
      expectedMessage: "Error analyzing pollution image",
    },
  ] as const;

  it.each(failingGenerateContentCases)(
    "$name devuelve 500 si falla la generación",
    async ({ handler, body, expectedMessage }) => {
      mockModelWithGenerateError();
      const res = createRes();

      await handler({ method: "POST", body } as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(expectedMessage);
    }
  );
});
