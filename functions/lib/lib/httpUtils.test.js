"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const httpUtils_1 = require("./httpUtils");
function createResMock() {
    const send = vitest_1.vi.fn();
    const status = vitest_1.vi.fn(() => ({ send }));
    return { status, send };
}
(0, vitest_1.describe)("httpUtils", () => {
    (0, vitest_1.it)("ensurePostMethod valida método HTTP", () => {
        const res = createResMock();
        (0, vitest_1.expect)((0, httpUtils_1.ensurePostMethod)({ method: "POST" }, res)).toBe(true);
        (0, vitest_1.expect)((0, httpUtils_1.ensurePostMethod)({ method: "GET" }, res)).toBe(false);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(405);
        (0, vitest_1.expect)(res.send).toHaveBeenCalledWith("Method Not Allowed");
    });
    (0, vitest_1.it)("resolveGeminiApiKey prioriza config sobre env", () => {
        (0, vitest_1.expect)((0, httpUtils_1.resolveGeminiApiKey)("cfg-key", "env-key")).toBe("cfg-key");
        (0, vitest_1.expect)((0, httpUtils_1.resolveGeminiApiKey)(undefined, "env-key")).toBe("env-key");
        (0, vitest_1.expect)((0, httpUtils_1.resolveGeminiApiKey)(undefined, undefined)).toBeNull();
    });
    (0, vitest_1.it)("ensureGeminiApiKey devuelve error 500 cuando falta la key", () => {
        const res = createResMock();
        (0, vitest_1.expect)((0, httpUtils_1.ensureGeminiApiKey)(res, undefined, undefined)).toBeNull();
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(500);
        (0, vitest_1.expect)(res.send).toHaveBeenCalledWith("API Key not configured");
    });
    (0, vitest_1.it)("stripJsonCodeFences elimina fences markdown", () => {
        (0, vitest_1.expect)((0, httpUtils_1.stripJsonCodeFences)("```json\n{\"ok\":true}\n```")).toBe("{\"ok\":true}");
    });
    (0, vitest_1.it)("parseModelJson parsea JSON saneado", () => {
        (0, vitest_1.expect)((0, httpUtils_1.parseModelJson)("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
    });
});
//# sourceMappingURL=httpUtils.test.js.map