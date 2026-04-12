"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const runtimeMocks = vitest_1.vi.hoisted(() => ({
    configValue: { gemini: { key: "cfg-key" } },
    onRequest: vitest_1.vi.fn((handler) => handler),
    initializeApp: vitest_1.vi.fn(),
    createGeminiModel: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("firebase-functions", () => ({
    https: {
        onRequest: runtimeMocks.onRequest,
    },
    config: () => runtimeMocks.configValue,
}));
vitest_1.vi.mock("firebase-admin", () => ({
    initializeApp: runtimeMocks.initializeApp,
}));
vitest_1.vi.mock("cors", () => ({
    default: () => (_req, _res, next) => next(),
}));
vitest_1.vi.mock("./lib/aiClient", () => ({
    createGeminiModel: runtimeMocks.createGeminiModel,
}));
const index_1 = require("./index");
function createRes() {
    const res = {
        status: vitest_1.vi.fn().mockReturnThis(),
        send: vitest_1.vi.fn().mockReturnThis(),
        json: vitest_1.vi.fn().mockReturnThis(),
    };
    return res;
}
function mockModelWithText(text) {
    const generateContent = vitest_1.vi.fn().mockResolvedValue({
        response: { text: () => text },
    });
    const sendMessage = vitest_1.vi.fn().mockResolvedValue({
        response: { text: () => text },
    });
    const startChat = vitest_1.vi.fn().mockReturnValue({ sendMessage });
    runtimeMocks.createGeminiModel.mockReturnValue({
        generateContent,
        startChat,
    });
    return { generateContent, startChat, sendMessage };
}
function mockModelWithGenerateError(message = "boom") {
    const generateContent = vitest_1.vi.fn().mockRejectedValue(new Error(message));
    runtimeMocks.createGeminiModel.mockReturnValue({
        generateContent,
        startChat: vitest_1.vi.fn(),
    });
}
function mockModelWithChatError(message = "boom") {
    const sendMessage = vitest_1.vi.fn().mockRejectedValue(new Error(message));
    const startChat = vitest_1.vi.fn().mockReturnValue({ sendMessage });
    runtimeMocks.createGeminiModel.mockReturnValue({
        generateContent: vitest_1.vi.fn(),
        startChat,
    });
}
(0, vitest_1.describe)("functions/index integration", () => {
    (0, vitest_1.beforeEach)(() => {
        runtimeMocks.configValue = { gemini: { key: "cfg-key" } };
        runtimeMocks.createGeminiModel.mockReset();
    });
    (0, vitest_1.it)("inicializa app y registra handlers HTTP", () => {
        (0, vitest_1.expect)(runtimeMocks.initializeApp).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(runtimeMocks.onRequest).toHaveBeenCalledTimes(9);
    });
    (0, vitest_1.it)("todos los handlers rechazan método distinto de POST", async () => {
        const handlers = [
            index_1.analyzeReport,
            index_1.chatWithRocco,
            index_1.validateDonation,
            index_1.validateRequest,
            index_1.generateMissions,
            index_1.getRoccoFeedback,
            index_1.summarizeNews,
            index_1.summarizeFile,
            index_1.analyzePollutionImage,
        ];
        for (const handler of handlers) {
            const res = createRes();
            await handler({ method: "GET", body: {} }, res);
            (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(405);
            (0, vitest_1.expect)(res.send).toHaveBeenCalledWith("Method Not Allowed");
        }
    });
    (0, vitest_1.it)("devuelve 500 cuando no hay API key", async () => {
        runtimeMocks.configValue = {};
        const previousEnv = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        const res = createRes();
        await (0, index_1.validateRequest)({ method: "POST", body: { title: "t", content: "c", tag: "x" } }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(500);
        (0, vitest_1.expect)(res.send).toHaveBeenCalledWith("API Key not configured");
        if (previousEnv)
            process.env.GEMINI_API_KEY = previousEnv;
    });
    const noApiKeyCases = [
        {
            name: "analyzeReport",
            handler: index_1.analyzeReport,
            body: { image: "base64", description: "desc", language: "es" },
        },
        {
            name: "chatWithRocco",
            handler: index_1.chatWithRocco,
            body: { messages: [{ role: "user", content: "Hola" }], systemInstruction: "system" },
        },
        {
            name: "validateDonation",
            handler: index_1.validateDonation,
            body: { images: ["img"], title: "T", tag: "ropa" },
        },
        {
            name: "generateMissions",
            handler: index_1.generateMissions,
            body: { userContext: "ctx" },
        },
        {
            name: "getRoccoFeedback",
            handler: index_1.getRoccoFeedback,
            body: { behavior: "limpió plaza" },
        },
        {
            name: "summarizeNews",
            handler: index_1.summarizeNews,
            body: { isCrisis: false },
        },
        {
            name: "summarizeFile",
            handler: index_1.summarizeFile,
            body: { base64Data: "abc", mimeType: "image/jpeg" },
        },
        {
            name: "analyzePollutionImage",
            handler: index_1.analyzePollutionImage,
            body: { base64Image: "img" },
        },
    ];
    vitest_1.it.each(noApiKeyCases)("$name devuelve 500 cuando no hay API key", async ({ handler, body }) => {
        runtimeMocks.configValue = {};
        const previousEnv = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        const res = createRes();
        await handler({ method: "POST", body }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(500);
        (0, vitest_1.expect)(res.send).toHaveBeenCalledWith("API Key not configured");
        if (previousEnv)
            process.env.GEMINI_API_KEY = previousEnv;
    });
    (0, vitest_1.it)("analyzeReport parsea JSON y responde 200", async () => {
        const model = mockModelWithText("```json\n{\"ok\":true}\n```");
        const res = createRes();
        await (0, index_1.analyzeReport)({ method: "POST", body: { image: "base64", description: "desc", language: "es" } }, res);
        (0, vitest_1.expect)(runtimeMocks.createGeminiModel).toHaveBeenCalledWith("cfg-key");
        (0, vitest_1.expect)(model.generateContent).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ ok: true });
    });
    (0, vitest_1.it)("analyzeReport usa prompt en inglés cuando language no es es", async () => {
        const model = mockModelWithText("{\"ok\":true}");
        const res = createRes();
        await (0, index_1.analyzeReport)({ method: "POST", body: { image: "base64", description: "desc", language: "en" } }, res);
        const promptPayload = model.generateContent.mock.calls[0]?.[0];
        (0, vitest_1.expect)(promptPayload[0]).toContain("Analyze this image and description of an environmental problem");
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ ok: true });
    });
    (0, vitest_1.it)("validateDonation parsea JSON y responde 200", async () => {
        const model = mockModelWithText("```json\n{\"valid\":true,\"reason\":\"ok\"}\n```");
        const res = createRes();
        await (0, index_1.validateDonation)({
            method: "POST",
            body: {
                images: ["data:image/jpeg;base64,img-encoded", "img-raw"],
                title: "T",
                tag: "ropa",
            },
        }, res);
        const donationPayload = model.generateContent.mock.calls[0]?.[0];
        (0, vitest_1.expect)(donationPayload[1]).toEqual({
            inlineData: { data: "img-encoded", mimeType: "image/jpeg" },
        });
        (0, vitest_1.expect)(donationPayload[2]).toEqual({
            inlineData: { data: "img-raw", mimeType: "image/jpeg" },
        });
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ valid: true, reason: "ok" });
    });
    (0, vitest_1.it)("validateRequest parsea JSON y responde 200", async () => {
        mockModelWithText("{\"valid\":true}");
        const res = createRes();
        await (0, index_1.validateRequest)({ method: "POST", body: { title: "t", content: "c", tag: "x" } }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ valid: true });
    });
    (0, vitest_1.it)("generateMissions parsea array JSON y responde 200", async () => {
        mockModelWithText("[{\"id\":\"m1\",\"title\":\"Misión\",\"description\":\"D\",\"points\":10,\"type\":\"cleanup\"}]");
        const res = createRes();
        await (0, index_1.generateMissions)({ method: "POST", body: { userContext: "ctx" } }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith([
            { id: "m1", title: "Misión", description: "D", points: 10, type: "cleanup" },
        ]);
    });
    (0, vitest_1.it)("getRoccoFeedback devuelve texto del modelo", async () => {
        mockModelWithText("Seguí así");
        const res = createRes();
        await (0, index_1.getRoccoFeedback)({ method: "POST", body: { behavior: "limpió plaza" } }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ text: "Seguí así" });
    });
    (0, vitest_1.it)("summarizeNews parsea JSON y responde 200", async () => {
        mockModelWithText("[{\"title\":\"t\",\"summary\":\"s\",\"source\":\"x\",\"isCrisis\":false}]");
        const res = createRes();
        await (0, index_1.summarizeNews)({ method: "POST", body: { isCrisis: false } }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith([
            { title: "t", summary: "s", source: "x", isCrisis: false },
        ]);
    });
    (0, vitest_1.it)("summarizeNews parsea JSON en modo crisis", async () => {
        mockModelWithText("[{\"title\":\"Alerta\",\"summary\":\"Inundación\",\"source\":\"noticias\",\"isCrisis\":true}]");
        const res = createRes();
        await (0, index_1.summarizeNews)({ method: "POST", body: { isCrisis: true } }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith([
            { title: "Alerta", summary: "Inundación", source: "noticias", isCrisis: true },
        ]);
    });
    (0, vitest_1.it)("summarizeFile devuelve texto del modelo", async () => {
        const model = mockModelWithText("Resumen de archivo");
        const res = createRes();
        await (0, index_1.summarizeFile)({ method: "POST", body: { base64Data: "data:image/jpeg;base64,abc", mimeType: "image/jpeg" } }, res);
        const summarizePayload = model.generateContent.mock.calls[0]?.[0];
        (0, vitest_1.expect)(summarizePayload[0]).toEqual({
            inlineData: { data: "abc", mimeType: "image/jpeg" },
        });
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ text: "Resumen de archivo" });
    });
    (0, vitest_1.it)("analyzePollutionImage parsea JSON y responde 200", async () => {
        const model = mockModelWithText("{\"urgency\":3}");
        const res = createRes();
        await (0, index_1.analyzePollutionImage)({ method: "POST", body: { base64Image: "data:image/jpeg;base64,img" } }, res);
        const pollutionPayload = model.generateContent.mock.calls[0]?.[0];
        (0, vitest_1.expect)(pollutionPayload[0]).toEqual({
            inlineData: { data: "img", mimeType: "image/jpeg" },
        });
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ urgency: 3 });
    });
    (0, vitest_1.it)("chatWithRocco responde texto del modelo", async () => {
        const model = mockModelWithText("Respuesta de Rocco");
        const res = createRes();
        await (0, index_1.chatWithRocco)({
            method: "POST",
            body: {
                systemInstruction: "system",
                messages: [
                    { role: "user", content: "Hola" },
                    { role: "assistant", content: "¿Cómo estás?" },
                    { role: "user", content: "Necesito ayuda" },
                ],
            },
        }, res);
        (0, vitest_1.expect)(model.startChat).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(model.sendMessage).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ text: "Respuesta de Rocco" });
    });
    (0, vitest_1.it)("chatWithRocco devuelve 500 si falla sendMessage", async () => {
        mockModelWithChatError();
        const res = createRes();
        await (0, index_1.chatWithRocco)({
            method: "POST",
            body: {
                systemInstruction: "system",
                messages: [
                    { role: "assistant", content: "Hola" },
                    { role: "user", content: "Necesito ayuda" },
                ],
            },
        }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(500);
        (0, vitest_1.expect)(res.send).toHaveBeenCalledWith("Error in Rocco chat");
    });
    const failingGenerateContentCases = [
        {
            name: "analyzeReport",
            handler: index_1.analyzeReport,
            body: { image: "base64", description: "desc", language: "es" },
            expectedMessage: "Error analyzing report",
        },
        {
            name: "validateDonation",
            handler: index_1.validateDonation,
            body: { images: ["img"], title: "T", tag: "ropa" },
            expectedMessage: "Error validating donation",
        },
        {
            name: "validateRequest",
            handler: index_1.validateRequest,
            body: { title: "t", content: "c", tag: "x" },
            expectedMessage: "Error validating request",
        },
        {
            name: "generateMissions",
            handler: index_1.generateMissions,
            body: { userContext: "ctx" },
            expectedMessage: "Error generating missions",
        },
        {
            name: "getRoccoFeedback",
            handler: index_1.getRoccoFeedback,
            body: { behavior: "limpió plaza" },
            expectedMessage: "Error getting Rocco feedback",
        },
        {
            name: "summarizeNews",
            handler: index_1.summarizeNews,
            body: { isCrisis: false },
            expectedMessage: "Error summarizing news",
        },
        {
            name: "summarizeFile",
            handler: index_1.summarizeFile,
            body: { base64Data: "abc", mimeType: "image/jpeg" },
            expectedMessage: "Error summarizing file",
        },
        {
            name: "analyzePollutionImage",
            handler: index_1.analyzePollutionImage,
            body: { base64Image: "img" },
            expectedMessage: "Error analyzing pollution image",
        },
    ];
    vitest_1.it.each(failingGenerateContentCases)("$name devuelve 500 si falla la generación", async ({ handler, body, expectedMessage }) => {
        mockModelWithGenerateError();
        const res = createRes();
        await handler({ method: "POST", body }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(500);
        (0, vitest_1.expect)(res.send).toHaveBeenCalledWith(expectedMessage);
    });
});
//# sourceMappingURL=index.integration.test.js.map