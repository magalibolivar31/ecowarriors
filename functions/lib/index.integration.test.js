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
    (0, vitest_1.it)("analyzeReport parsea JSON y responde 200", async () => {
        mockModelWithText("```json\n{\"ok\":true}\n```");
        const res = createRes();
        await (0, index_1.analyzeReport)({ method: "POST", body: { image: "base64", description: "desc", language: "es" } }, res);
        (0, vitest_1.expect)(runtimeMocks.createGeminiModel).toHaveBeenCalledWith("cfg-key");
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ ok: true });
    });
    (0, vitest_1.it)("validateDonation parsea JSON y responde 200", async () => {
        mockModelWithText("```json\n{\"valid\":true,\"reason\":\"ok\"}\n```");
        const res = createRes();
        await (0, index_1.validateDonation)({ method: "POST", body: { images: ["img"], title: "T", tag: "ropa" } }, res);
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
    (0, vitest_1.it)("summarizeFile devuelve texto del modelo", async () => {
        mockModelWithText("Resumen de archivo");
        const res = createRes();
        await (0, index_1.summarizeFile)({ method: "POST", body: { base64Data: "abc", mimeType: "image/jpeg" } }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ text: "Resumen de archivo" });
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
    (0, vitest_1.it)("validateRequest devuelve 500 si falla el modelo", async () => {
        const generateContent = vitest_1.vi.fn().mockRejectedValue(new Error("boom"));
        runtimeMocks.createGeminiModel.mockReturnValue({
            generateContent,
            startChat: vitest_1.vi.fn(),
        });
        const res = createRes();
        await (0, index_1.validateRequest)({ method: "POST", body: { title: "t", content: "c", tag: "x" } }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(500);
        (0, vitest_1.expect)(res.send).toHaveBeenCalledWith("Error validating request");
    });
    (0, vitest_1.it)("analyzePollutionImage devuelve 500 si falla la generación", async () => {
        const generateContent = vitest_1.vi.fn().mockRejectedValue(new Error("boom"));
        runtimeMocks.createGeminiModel.mockReturnValue({
            generateContent,
            startChat: vitest_1.vi.fn(),
        });
        const res = createRes();
        await (0, index_1.analyzePollutionImage)({ method: "POST", body: { base64Image: "img" } }, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(500);
        (0, vitest_1.expect)(res.send).toHaveBeenCalledWith("Error analyzing pollution image");
    });
});
//# sourceMappingURL=index.integration.test.js.map