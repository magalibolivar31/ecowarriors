import { GoogleGenerativeAI } from "@google/generative-ai";

// --- Key rotation -----------------------------------------------------------
// Keys are tried in order. On a 429 (quota exhausted) the next key is used.
// Any other error is re-thrown immediately without rotating.

const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY,
  import.meta.env.VITE_GEMINI_API_KEY2,
  import.meta.env.VITE_GEMINI_API_KEY3,
].filter((k): k is string => typeof k === 'string' && k.length > 0);

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit')
  );
}

async function withKeyRotation<T>(
  fn: (client: GoogleGenerativeAI) => Promise<T>
): Promise<T> {
  if (API_KEYS.length === 0) throw new Error('No Gemini API keys configured');
  let lastError: unknown;
  for (const key of API_KEYS) {
    try {
      return await fn(new GoogleGenerativeAI(key));
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn('[Gemini] Quota exceeded, rotating to next key…');
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------

export interface ReportAnalysis {
  categoria: string;
  subcategorias: string[];
  volumenEstimado: string;
  nivelUrgencia: number;
  analisis: string;
  isValid: boolean;
  validationError: string | null;
  descriptionMatches: boolean;
  serviceUnavailable?: boolean;
}

export const analyzeReport = async (imageB64: string, description: string, location: string): Promise<ReportAnalysis> => {
  try {
    const prompt = `You are a strict content validator for EcoWarriors, an urban
environmental crisis reporting app in Argentina. You must analyze BOTH the image
and the text description independently and then cross-check them.

---
USER DESCRIPTION TEXT: "${description}"
LOCATION: ${location}
---

LAYER 1 — TEXT VALIDATION (analyze the description text only, ignore the image):
Reject the description (descriptionValid: false) if ANY of the following is true:
- It is less than 10 meaningful characters
- It is random characters, keyboard mashing (e.g. "asdf", "aaaa", "1234", "qwerty")
- It is an insult, joke, or offensive content
- It is completely off-topic (e.g. "me gusta la pizza", "hola", "test", "prueba")
- It contains no meaningful information about an environmental or crisis problem
Accept (descriptionValid: true) only if it clearly describes an environmental
or urban crisis situation (garbage, flooding, damage, pollution, etc.)

LAYER 2 — IMAGE VALIDATION (analyze the image only, ignore the description):
Reject the image (isEnvironmental: false) if it shows:
- A person's face or a selfie
- Food, drinks, or indoor domestic scenes unrelated to damage
- Animals not related to waste or environmental issues
- Screenshots, memes, text on screen, QR codes
- A blank, black, blurry, or completely dark image
- Any scene unrelated to urban environmental problems
Accept (isEnvironmental: true) only if the image CLEARLY shows one of:
- Garbage, waste, litter, or pollution on streets, drains, or open areas
- Flooding, waterlogged streets, or water damage
- Structural damage: collapsed infrastructure, broken pavement, fallen trees
- Environmental hazards: chemical spills, illegal dumping, blocked drains

LAYER 3 — CROSS VALIDATION (only if both layers pass):
Check if the description and image are consistent with each other.
Set descriptionMatches: false if they clearly contradict
(e.g. description says "flooding" but image shows a pile of garbage —
minor differences are ok, blatant contradictions are not).

For each rejection, provide a specific rejectionReason in Spanish that tells
the user exactly what was wrong. Examples:
- "La descripción parece texto aleatorio. Describí el problema ambiental con tus propias palabras."
- "La imagen no muestra un problema ambiental. Usá una foto del lugar afectado."
- "La imagen y la descripción no coinciden. Verificá que la foto corresponda al problema que describís."
- "La descripción no está relacionada con un problema ambiental o de crisis urbana."

Respond ONLY with this JSON (no markdown, no extra text):
{
  "isEnvironmental": boolean,
  "descriptionValid": boolean,
  "descriptionMatches": boolean,
  "wasteType": "Plástico" | "Orgánico" | "Escombros" | "Tóxico" | "Vidrio" | "Metal" | "Inundación" | "Daño estructural" | "Otro",
  "urgency": number between 1 and 5,
  "description": "brief technical analysis in Spanish, max 100 characters",
  "rejectionReason": string | null
}`;

    const data = await withKeyRotation(async (client) => {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: imageB64, mimeType: "image/jpeg" } }
      ]);
      return JSON.parse(result.response.text());
    });

    const isValid = data.isEnvironmental && data.descriptionValid && data.descriptionMatches;

    return {
      isValid,
      validationError: !isValid ? data.rejectionReason : null,
      descriptionMatches: data.descriptionMatches,
      categoria: data.wasteType || 'Otro',
      subcategorias: [],
      volumenEstimado: 'No especificado',
      nivelUrgencia: data.urgency || 3,
      analisis: data.description || ''
    };
  } catch (error: any) {
    console.error("Gemini API error, using fallback:", error);
    return {
      isValid: false,
      validationError: null,
      descriptionMatches: true,
      categoria: 'Otro',
      subcategorias: [],
      volumenEstimado: 'No especificado',
      nivelUrgencia: 3,
      analisis: 'Análisis automático no disponible.',
      serviceUnavailable: true
    };
  }
};

export const validateDonation = async (
  imagesB64: string[],
  title: string,
  tag: string
): Promise<{ valid: boolean; reason?: string; retry?: boolean; serviceUnavailable?: boolean }> => {
  try {
    const prompt = `Valida si estas imágenes corresponden a una donación legítima de la categoría "${tag}" con el título "${title}".
    Responde en formato JSON con los campos: valid (boolean) y reason (string).`;

    const imageParts = imagesB64.map(b64 => ({
      inlineData: { data: b64, mimeType: "image/jpeg" }
    }));

    return await withKeyRotation(async (client) => {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent([prompt, ...imageParts]);
      return JSON.parse(result.response.text());
    });
  } catch (error) {
    console.error("Error in validateDonation via Gemini:", error);
    return {
      valid: true,
      reason: "No se pudo validar automáticamente la publicación. Se guardará igualmente.",
      retry: true,
      serviceUnavailable: true
    };
  }
};

export const validateRequest = async (
  title: string,
  content: string,
  tag: string
): Promise<{ valid: boolean; reason?: string; serviceUnavailable?: boolean }> => {
  try {
    const prompt = `Valida si esta solicitud de ayuda ambiental es legítima y apropiada.
    Título: "${title}"
    Contenido: "${content}"
    Categoría: "${tag}"

    Responde en formato JSON con los campos: valid (boolean) y reason (string).`;

    return await withKeyRotation(async (client) => {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    });
  } catch (error) {
    console.error("Error in validateRequest via Gemini:", error);
    return {
      valid: true,
      reason: "No se pudo validar automáticamente la publicación. Se guardará igualmente.",
      serviceUnavailable: true
    };
  }
};

export interface Mission {
  id: string;
  title: string;
  description: string;
  points: number;
  type: 'water' | 'cleanup' | 'prevention';
}

export const generateMissions = async (userContext: string): Promise<Mission[]> => {
  try {
    const prompt = `Genera 3 misiones ambientales personalizadas y motivadoras basadas en este contexto de usuario: "${userContext}".
    Responde en formato JSON como un array de objetos con estos campos: id (string único), title, description, points (number), type (uno de: 'water', 'cleanup', 'prevention').`;

    return await withKeyRotation(async (client) => {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    });
  } catch (error) {
    console.error("Error generating missions via Gemini:", error);
    return [];
  }
};

export const getRoccoFeedback = async (behavior: string): Promise<string> => {
  try {
    const prompt = `Eres Rocco, un perro guardián ambiental con mucha personalidad, rudo pero motivador.
    Da un feedback corto (máximo 150 caracteres) y con estilo sobre este comportamiento del usuario: "${behavior}".
    Responde en formato JSON con el campo: text (string).`;

    const data = await withKeyRotation(async (client) => {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    });

    return data.text || "¡Seguí así, EcoWarrior! Tu acción cuenta.";
  } catch (error) {
    console.error("Error getting Rocco feedback via Gemini:", error);
    return "¡Seguí así, EcoWarrior! Tu acción cuenta.";
  }
};

export interface NewsItem {
  title: string;
  summary: string;
  source: string;
  isCrisis: boolean;
}

export const summarizeEnvironmentalNews = async (isCrisis: boolean): Promise<NewsItem[]> => {
  try {
    const prompt = `Genera 3 noticias ambientales ficticias pero realistas ${isCrisis ? 'sobre crisis o desastres naturales actuales' : 'de actualidad y avances positivos'}.
    Responde en formato JSON como un array de objetos con estos campos: title, summary, source, isCrisis (boolean).`;

    return await withKeyRotation(async (client) => {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    });
  } catch (error) {
    console.error("Error summarizing news via Gemini:", error);
    return [];
  }
};

export const chatWithRocco = async (messages: { role: string; content: string }[], systemInstruction: string): Promise<{ text: string }> => {
  try {
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const firstUserIndex = history.findIndex(m => m.role === 'user');
    const validHistory = firstUserIndex !== -1 ? history.slice(firstUserIndex) : [];
    const lastMessage = messages[messages.length - 1].content;

    const text = await withKeyRotation(async (client) => {
      const model = client.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction });
      const chat = model.startChat({ history: validHistory });
      const result = await chat.sendMessage(lastMessage);
      return result.response.text();
    });

    return { text };
  } catch (error) {
    console.error("Error in chatWithRocco via Gemini:", error);
    return { text: "Lo siento, estoy teniendo problemas para procesar tu mensaje. ¡Intentá de nuevo más tarde!" };
  }
};
