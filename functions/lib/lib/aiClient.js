"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeminiModel = createGeminiModel;
const generative_ai_1 = require("@google/generative-ai");
function createGeminiModel(apiKey, model = "gemini-1.5-flash") {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model });
}
//# sourceMappingURL=aiClient.js.map