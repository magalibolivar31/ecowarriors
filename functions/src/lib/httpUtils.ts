type ReqLike = { method?: string };
type ResLike = {
  status: (code: number) => {
    send: (body: string) => unknown;
  };
};

export function ensurePostMethod(req: ReqLike, res: ResLike): boolean {
  if (req.method === "POST") return true;
  res.status(405).send("Method Not Allowed");
  return false;
}

export function resolveGeminiApiKey(
  configKey: string | undefined,
  envKey: string | undefined = process.env.GEMINI_API_KEY
): string | null {
  return configKey || envKey || null;
}

export function ensureGeminiApiKey(
  res: ResLike,
  configKey: string | undefined,
  envKey: string | undefined = process.env.GEMINI_API_KEY
): string | null {
  const key = resolveGeminiApiKey(configKey, envKey);
  if (!key) {
    res.status(500).send("API Key not configured");
    return null;
  }
  return key;
}

export function stripJsonCodeFences(text: string): string {
  return text.replace(/```json|```/g, "").trim();
}

export function parseModelJson<T>(text: string): T {
  return JSON.parse(stripJsonCodeFences(text)) as T;
}
