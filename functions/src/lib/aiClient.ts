import { GoogleGenerativeAI } from "@google/generative-ai";

export function createGeminiModel(apiKey: string, model = "gemini-1.5-flash") {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}
