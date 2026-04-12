import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({
  getGenerativeModel: vi.fn(),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = aiMocks.getGenerativeModel;
  },
}));

import { createGeminiModel } from "./aiClient";

describe("aiClient", () => {
  beforeEach(() => {
    aiMocks.getGenerativeModel.mockReset();
    aiMocks.getGenerativeModel.mockReturnValue({ model: "mocked-model" });
  });

  it("crea modelo de Gemini con nombre por defecto", () => {
    const model = createGeminiModel("key-1");
    expect(model).toEqual({ model: "mocked-model" });
    expect(aiMocks.getGenerativeModel).toHaveBeenCalledWith({ model: "gemini-1.5-flash" });
  });

  it("permite customizar nombre de modelo", () => {
    createGeminiModel("key-1", "gemini-2.0");
    expect(aiMocks.getGenerativeModel).toHaveBeenCalledWith({ model: "gemini-2.0" });
  });
});
