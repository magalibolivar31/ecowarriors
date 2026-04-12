import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface AIAnalysisResult {
  category: string;
  subcategories: string[];
  volumeRange: string;
  urgencyLevel: number; // 1-5
  description: string;
}

export const summarizeFile = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const prompt = "Resume el contenido de este archivo ambiental de forma concisa.";
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    return response.text() || "No se pudo generar un resumen.";
  } catch (error) {
    console.error("AI Summarization Error via Gemini:", error);
    return "Error al generar el resumen.";
  }
};

export const analyzePollutionImage = async (base64Image: string): Promise<AIAnalysisResult> => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Analiza esta imagen de contaminación. 
    Determina la categoría, subcategorías, rango de volumen y nivel de urgencia (1-5).
    Responde estrictamente en formato JSON con estos campos: category, subcategories (array), volumeRange, urgencyLevel, description.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const response = await result.response;
    return JSON.parse(response.text()) as AIAnalysisResult;
  } catch (error) {
    console.error("AI Analysis Error via Gemini:", error);
    return {
      category: 'Otro',
      subcategories: ['No identificado'],
      volumeRange: 'Desconocido',
      urgencyLevel: 3,
      description: "No se pudo realizar el análisis automático. Por favor, revisa manualmente.",
    };
  }
};
