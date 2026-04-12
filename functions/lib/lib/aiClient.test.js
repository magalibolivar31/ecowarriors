"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const aiMocks = vitest_1.vi.hoisted(() => ({
    getGenerativeModel: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("@google/generative-ai", () => ({
    GoogleGenerativeAI: class {
        constructor() {
            this.getGenerativeModel = aiMocks.getGenerativeModel;
        }
    },
}));
const aiClient_1 = require("./aiClient");
(0, vitest_1.describe)("aiClient", () => {
    (0, vitest_1.beforeEach)(() => {
        aiMocks.getGenerativeModel.mockReset();
        aiMocks.getGenerativeModel.mockReturnValue({ model: "mocked-model" });
    });
    (0, vitest_1.it)("crea modelo de Gemini con nombre por defecto", () => {
        const model = (0, aiClient_1.createGeminiModel)("key-1");
        (0, vitest_1.expect)(model).toEqual({ model: "mocked-model" });
        (0, vitest_1.expect)(aiMocks.getGenerativeModel).toHaveBeenCalledWith({ model: "gemini-1.5-flash" });
    });
    (0, vitest_1.it)("permite customizar nombre de modelo", () => {
        (0, aiClient_1.createGeminiModel)("key-1", "gemini-2.0");
        (0, vitest_1.expect)(aiMocks.getGenerativeModel).toHaveBeenCalledWith({ model: "gemini-2.0" });
    });
});
//# sourceMappingURL=aiClient.test.js.map