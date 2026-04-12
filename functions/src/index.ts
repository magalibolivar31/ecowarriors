import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import corsLib from "cors";
import { createGeminiModel } from "./lib/aiClient";
import { ensureGeminiApiKey, ensurePostMethod, parseModelJson } from "./lib/httpUtils";

admin.initializeApp();

const cors = corsLib({ origin: true });

function withCors(
  handler: (req: any, res: any) => Promise<void> | void
) {
  return functions.https.onRequest((req, res) => {
    return cors(req, res, async () => {
      await handler(req, res);
    });
  });
}

function getConfigApiKey(): string | undefined {
  return functions.config().gemini?.key;
}

export const analyzeReport = withCors(async (req, res) => {
  if (!ensurePostMethod(req, res)) return;

  const { image, description, language } = req.body;
  const apiKey = ensureGeminiApiKey(res, getConfigApiKey());
  if (!apiKey) return;

  try {
    const model = createGeminiModel(apiKey);

    const prompt =
      language === "es"
        ? `Analiza esta imagen y descripción de un problema ambiental: "${description}". Responde ÚNICAMENTE con un objeto JSON válido que tenga estos campos: title, description, wasteType (debe ser uno de: Plástico, Orgánico, Escombros, Tóxico, Vidrio, Metal, Otro), urgency (número del 1 al 5), isEnvironmental (boolean). No incluyas markdown.`
        : `Analyze this image and description of an environmental problem: "${description}". Respond ONLY with a valid JSON object with these fields: title, description, wasteType (must be one of: Plastic, Organic, Debris, Toxic, Glass, Metal, Other), urgency (number from 1 to 5), isEnvironmental (boolean). Do not include markdown.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: image,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    res.status(200).json(parseModelJson(response.text()));
  } catch (error) {
    console.error("Error analyzing report:", error);
    res.status(500).send("Error analyzing report");
  }
});

export const chatWithRocco = withCors(async (req, res) => {
  if (!ensurePostMethod(req, res)) return;

  const { messages, systemInstruction } = req.body;
  const apiKey = ensureGeminiApiKey(res, getConfigApiKey());
  if (!apiKey) return;

  try {
    const model = createGeminiModel(apiKey);

    const chat = model.startChat({
      history: messages.slice(0, -1).map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage([
      { text: `System Instruction: ${systemInstruction}` },
      { text: messages[messages.length - 1].content },
    ]);
    const response = await result.response;

    res.status(200).json({ text: response.text() });
  } catch (error) {
    console.error("Error in Rocco chat:", error);
    res.status(500).send("Error in Rocco chat");
  }
});

export const validateDonation = withCors(async (req, res) => {
  if (!ensurePostMethod(req, res)) return;

  const { images, title, tag } = req.body;
  const apiKey = ensureGeminiApiKey(res, getConfigApiKey());
  if (!apiKey) return;

  try {
    const model = createGeminiModel(apiKey);

    const prompt = `Valida si las imágenes corresponden a una donación de "${tag}" con el título "${title}".
      Las etiquetas permitidas son: "ropa", "comida", "otros".
      
      Criterios:
      - Sé flexible. Si la imagen muestra algo que razonablemente podría ser lo descrito, marca valid: true.
      - Solo marca valid: false si hay una contradicción evidente.
      - Si realmente no puedes distinguir NADA, usa retry: true.
      
      Responde en JSON:
      {
        "valid": boolean,
        "reason": "explicación breve",
        "retry": boolean
      }`;

    const result = await model.generateContent([
      prompt,
      ...images.map((img: string) => ({
        inlineData: {
          data: img.split(",")[1] || img,
          mimeType: "image/jpeg",
        },
      })),
    ]);

    const response = await result.response;
    res.status(200).json(parseModelJson(response.text()));
  } catch (error) {
    console.error("Error validating donation:", error);
    res.status(500).send("Error validating donation");
  }
});

export const validateRequest = withCors(async (req, res) => {
  if (!ensurePostMethod(req, res)) return;

  const { title, content, tag } = req.body;
  const apiKey = ensureGeminiApiKey(res, getConfigApiKey());
  if (!apiKey) return;

  try {
    const model = createGeminiModel(apiKey);

    const prompt = `Valida esta petición de ayuda/comunicado solidario.
      Título: "${title}"
      Contenido: "${content}"
      Etiqueta: "${tag}"
      Responde en JSON:
      {
        "valid": boolean,
        "reason": "explicación si es inválido"
      }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.status(200).json(parseModelJson(response.text()));
  } catch (error) {
    console.error("Error validating request:", error);
    res.status(500).send("Error validating request");
  }
});

export const generateMissions = withCors(async (req, res) => {
  if (!ensurePostMethod(req, res)) return;

  const { userContext } = req.body;
  const apiKey = ensureGeminiApiKey(res, getConfigApiKey());
  if (!apiKey) return;

  try {
    const model = createGeminiModel(apiKey);

    const prompt = `Genera 3 misiones dinámicas para un EcoWarrior basadas en este contexto: "${userContext}".
      Responde ÚNICAMENTE en formato JSON:
      [
        {
          "id": "string",
          "title": "string",
          "description": "string",
          "points": number,
          "type": "water" | "cleanup" | "prevention"
        }
      ]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.status(200).json(parseModelJson(response.text()));
  } catch (error) {
    console.error("Error generating missions:", error);
    res.status(500).send("Error generating missions");
  }
});

export const getRoccoFeedback = withCors(async (req, res) => {
  if (!ensurePostMethod(req, res)) return;

  const { behavior } = req.body;
  const apiKey = ensureGeminiApiKey(res, getConfigApiKey());
  if (!apiKey) return;

  try {
    const model = createGeminiModel(apiKey);

    const prompt = `Como Rocco, un asistente ambiental sabio y motivador, da una frase corta de feedback personalizada sobre este comportamiento del usuario: "${behavior}". Máximo 15 palabras.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.status(200).json({ text: response.text() });
  } catch (error) {
    console.error("Error getting Rocco feedback:", error);
    res.status(500).send("Error getting Rocco feedback");
  }
});

export const summarizeNews = withCors(async (req, res) => {
  if (!ensurePostMethod(req, res)) return;

  const { isCrisis } = req.body;
  const apiKey = ensureGeminiApiKey(res, getConfigApiKey());
  if (!apiKey) return;

  try {
    const model = createGeminiModel(apiKey);

    const prompt = `Genera 3 noticias ambientales actuales resumidas. 
      Modo: ${isCrisis ? "CRISIS (enfocado en alertas, inundaciones, emergencias)" : "NORMAL (enfocado en sustentabilidad, eventos, avances)"}.
      Responde ÚNICAMENTE en formato JSON:
      [
        {
          "title": "string",
          "summary": "string (máximo 20 palabras)",
          "source": "string",
          "isCrisis": boolean
        }
      ]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.status(200).json(parseModelJson(response.text()));
  } catch (error) {
    console.error("Error summarizing news:", error);
    res.status(500).send("Error summarizing news");
  }
});

export const summarizeFile = withCors(async (req, res) => {
  if (!ensurePostMethod(req, res)) return;

  const { base64Data, mimeType } = req.body;
  const apiKey = ensureGeminiApiKey(res, getConfigApiKey());
  if (!apiKey) return;

  try {
    const model = createGeminiModel(apiKey);

    const prompt =
      "Resume este archivo de forma concisa. Si es una imagen, describe lo que ves. Si es un documento, extrae los puntos clave.";

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data.split(",")[1] || base64Data,
          mimeType,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    res.status(200).json({ text: response.text() });
  } catch (error) {
    console.error("Error summarizing file:", error);
    res.status(500).send("Error summarizing file");
  }
});

export const analyzePollutionImage = withCors(async (req, res) => {
  if (!ensurePostMethod(req, res)) return;

  const { base64Image } = req.body;
  const apiKey = ensureGeminiApiKey(res, getConfigApiKey());
  if (!apiKey) return;

  try {
    const model = createGeminiModel(apiKey);

    const prompt =
      "Analiza esta imagen de contaminación ambiental. Identifica la categoría principal de residuos, subcategorías específicas, estima el rango de volumen y determina un nivel de urgencia del 1 al 5 (donde 5 es crítico). Proporciona una descripción breve. Responde ÚNICAMENTE en JSON.";

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image.split(",")[1] || base64Image,
          mimeType: "image/jpeg",
        },
      },
      prompt,
    ]);

    const response = await result.response;
    res.status(200).json(parseModelJson(response.text()));
  } catch (error) {
    console.error("Error analyzing pollution image:", error);
    res.status(500).send("Error analyzing pollution image");
  }
});
