"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensurePostMethod = ensurePostMethod;
exports.resolveGeminiApiKey = resolveGeminiApiKey;
exports.ensureGeminiApiKey = ensureGeminiApiKey;
exports.stripJsonCodeFences = stripJsonCodeFences;
exports.parseModelJson = parseModelJson;
function ensurePostMethod(req, res) {
    if (req.method === "POST")
        return true;
    res.status(405).send("Method Not Allowed");
    return false;
}
function resolveGeminiApiKey(configKey, envKey = process.env.GEMINI_API_KEY) {
    return configKey || envKey || null;
}
function ensureGeminiApiKey(res, configKey, envKey = process.env.GEMINI_API_KEY) {
    const key = resolveGeminiApiKey(configKey, envKey);
    if (!key) {
        res.status(500).send("API Key not configured");
        return null;
    }
    return key;
}
function stripJsonCodeFences(text) {
    return text.replace(/```json|```/g, "").trim();
}
function parseModelJson(text) {
    return JSON.parse(stripJsonCodeFences(text));
}
//# sourceMappingURL=httpUtils.js.map