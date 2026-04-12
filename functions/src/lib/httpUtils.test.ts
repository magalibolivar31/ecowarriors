import { describe, expect, it, vi } from "vitest";
import {
  ensureGeminiApiKey,
  ensurePostMethod,
  parseModelJson,
  resolveGeminiApiKey,
  stripJsonCodeFences,
} from "./httpUtils";

function createResMock() {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));
  return { status, send };
}

describe("httpUtils", () => {
  it("ensurePostMethod valida método HTTP", () => {
    const res = createResMock();

    expect(ensurePostMethod({ method: "POST" }, res as any)).toBe(true);
    expect(ensurePostMethod({ method: "GET" }, res as any)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.send).toHaveBeenCalledWith("Method Not Allowed");
  });

  it("resolveGeminiApiKey prioriza config sobre env", () => {
    expect(resolveGeminiApiKey("cfg-key", "env-key")).toBe("cfg-key");
    expect(resolveGeminiApiKey(undefined, "env-key")).toBe("env-key");
    expect(resolveGeminiApiKey(undefined, undefined)).toBeNull();
  });

  it("ensureGeminiApiKey devuelve error 500 cuando falta la key", () => {
    const res = createResMock();
    expect(ensureGeminiApiKey(res as any, undefined, undefined)).toBeNull();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("API Key not configured");
  });

  it("stripJsonCodeFences elimina fences markdown", () => {
    expect(stripJsonCodeFences("```json\n{\"ok\":true}\n```")).toBe("{\"ok\":true}");
  });

  it("parseModelJson parsea JSON saneado", () => {
    expect(parseModelJson<{ ok: boolean }>("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });
});
