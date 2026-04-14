import { beforeEach, describe, expect, it, vi } from 'vitest';

const geminiMocks = vi.hoisted(() => {
  const responseText = vi.fn();
  const generateContent = vi.fn();
  const sendMessage = vi.fn();
  const startChat = vi.fn().mockReturnValue({ sendMessage });
  const getGenerativeModel = vi.fn().mockReturnValue({
    generateContent,
    startChat,
  });

  generateContent.mockResolvedValue({
    response: { text: responseText },
  });
  sendMessage.mockResolvedValue({
    response: { text: responseText },
  });

  return {
    responseText,
    generateContent,
    sendMessage,
    startChat,
    getGenerativeModel,
  };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = geminiMocks.getGenerativeModel;
  },
}));

import {
  analyzeReport,
  chatWithRocco,
  generateMissions,
  getRoccoFeedback,
  summarizeEnvironmentalNews,
  validateDonation,
  validateRequest,
} from './geminiService';

describe('geminiService', () => {
  beforeEach(() => {
    geminiMocks.responseText.mockReset();
    geminiMocks.generateContent.mockReset();
    geminiMocks.sendMessage.mockReset();
    geminiMocks.startChat.mockReset();
    geminiMocks.getGenerativeModel.mockReset();

    geminiMocks.startChat.mockReturnValue({ sendMessage: geminiMocks.sendMessage });
    geminiMocks.getGenerativeModel.mockReturnValue({
      generateContent: geminiMocks.generateContent,
      startChat: geminiMocks.startChat,
    });
    geminiMocks.generateContent.mockResolvedValue({
      response: { text: geminiMocks.responseText },
    });
    geminiMocks.sendMessage.mockResolvedValue({
      response: { text: geminiMocks.responseText },
    });
  });

  it('analyzeReport mapea respuesta válida', async () => {
    geminiMocks.responseText.mockReturnValueOnce(
      JSON.stringify({
        isEnvironmental: true,
        descriptionValid: true,
        descriptionMatches: true,
        wasteType: 'Plástico',
        urgency: 4,
        description: 'Basural con riesgo de obstrucción',
        rejectionReason: null,
      }),
    );

    const result = await analyzeReport('imageb64', 'Descripción detallada', 'CABA');

    expect(result).toEqual({
      isValid: true,
      validationError: null,
      descriptionMatches: true,
      categoria: 'Plástico',
      subcategorias: [],
      volumenEstimado: 'No especificado',
      nivelUrgencia: 4,
      analisis: 'Basural con riesgo de obstrucción',
    });
  });

  it('analyzeReport mapea respuesta no válida con campos faltantes', async () => {
    geminiMocks.responseText.mockReturnValueOnce(
      JSON.stringify({
        isEnvironmental: false,
        descriptionValid: true,
        descriptionMatches: false,
        rejectionReason: 'La imagen no muestra un problema ambiental.',
        // wasteType, urgency, description omitted → fallback values
      }),
    );

    const result = await analyzeReport('imageb64', 'Descripción', 'CABA');

    expect(result.isValid).toBe(false);
    expect(result.validationError).toBe('La imagen no muestra un problema ambiental.');
    expect(result.categoria).toBe('Otro');
    expect(result.nivelUrgencia).toBe(3);
    expect(result.analisis).toBe('');
  });

  it('analyzeReport devuelve fallback si falla Gemini', async () => {
    geminiMocks.generateContent.mockRejectedValueOnce(new Error('network'));

    const result = await analyzeReport('imageb64', 'Descripción detallada', 'CABA');

    expect(result.isValid).toBe(false);
    expect(result.validationError).toContain('No se pudo verificar el reporte automáticamente');
  });

  it('validateDonation parsea respuesta JSON', async () => {
    geminiMocks.responseText.mockReturnValueOnce(JSON.stringify({ valid: true, reason: 'ok' }));
    await expect(validateDonation(['a', 'b'], 'Título', 'ropa')).resolves.toEqual({
      valid: true,
      reason: 'ok',
    });
  });

  it('validateDonation devuelve fallback en error', async () => {
    geminiMocks.generateContent.mockRejectedValueOnce(new Error('fail'));
    await expect(validateDonation(['a'], 'Título', 'ropa')).resolves.toEqual({
      valid: true,
      reason: 'No se pudo validar automáticamente la publicación. Se guardará igualmente.',
      retry: true,
      serviceUnavailable: true,
    });
  });

  it('validateRequest devuelve fallback en error', async () => {
    geminiMocks.generateContent.mockRejectedValueOnce(new Error('fail'));
    await expect(validateRequest('T', 'C', 'otros')).resolves.toEqual({
      valid: true,
      reason: 'No se pudo validar automáticamente la publicación. Se guardará igualmente.',
      serviceUnavailable: true,
    });
  });

  it('generateMissions devuelve [] si falla', async () => {
    geminiMocks.generateContent.mockRejectedValueOnce(new Error('fail'));
    await expect(generateMissions('contexto')).resolves.toEqual([]);
  });

  it('generateMissions parsea respuesta JSON', async () => {
    const missions = [{ id: 'm1', title: 'Limpiar', description: 'desc', points: 50, type: 'cleanup' }];
    geminiMocks.responseText.mockReturnValueOnce(JSON.stringify(missions));
    await expect(generateMissions('usuario activo')).resolves.toEqual(missions);
  });

  it('getRoccoFeedback usa texto generado o fallback de contenido', async () => {
    geminiMocks.responseText.mockReturnValueOnce(JSON.stringify({ text: 'Buen trabajo' }));
    await expect(getRoccoFeedback('ayudó en limpieza')).resolves.toBe('Buen trabajo');

    geminiMocks.responseText.mockReturnValueOnce(JSON.stringify({}));
    await expect(getRoccoFeedback('otra acción')).resolves.toBe(
      '¡Seguí así, EcoWarrior! Tu acción cuenta.',
    );
  });

  it('getRoccoFeedback devuelve fallback si falla Gemini', async () => {
    geminiMocks.generateContent.mockRejectedValueOnce(new Error('fail'));
    await expect(getRoccoFeedback('una acción')).resolves.toBe(
      '¡Seguí así, EcoWarrior! Tu acción cuenta.',
    );
  });

  it('summarizeEnvironmentalNews devuelve [] si falla', async () => {
    geminiMocks.generateContent.mockRejectedValueOnce(new Error('fail'));
    await expect(summarizeEnvironmentalNews(false)).resolves.toEqual([]);
  });

  it('summarizeEnvironmentalNews parsea respuesta en modo crisis', async () => {
    const news = [{ title: 'Crisis', summary: 'Inundación', source: 'fuente', isCrisis: true }];
    geminiMocks.responseText.mockReturnValueOnce(JSON.stringify(news));
    await expect(summarizeEnvironmentalNews(true)).resolves.toEqual(news);
  });

  it('summarizeEnvironmentalNews parsea respuesta en modo normal', async () => {
    const news = [{ title: 'Avance', summary: 'Positivo', source: 'fuente', isCrisis: false }];
    geminiMocks.responseText.mockReturnValueOnce(JSON.stringify(news));
    await expect(summarizeEnvironmentalNews(false)).resolves.toEqual(news);
  });

  it('validateRequest parsea respuesta JSON', async () => {
    geminiMocks.responseText.mockReturnValueOnce(JSON.stringify({ valid: true, reason: 'ok' }));
    await expect(validateRequest('Título', 'Contenido', 'ropa')).resolves.toEqual({
      valid: true,
      reason: 'ok',
    });
  });

  it('chatWithRocco envía último mensaje y recorta historial inválido', async () => {
    geminiMocks.responseText.mockReturnValueOnce('Respuesta del chat');

    const messages = [
      { role: 'assistant', content: 'Hola soy bot' },
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: '¿Cómo estás?' },
      { role: 'user', content: 'Necesito ayuda' },
    ];

    const result = await chatWithRocco(messages, 'system');

    expect(result).toEqual({ text: 'Respuesta del chat' });
    expect(geminiMocks.startChat).toHaveBeenCalledTimes(1);

    const startChatArg = geminiMocks.startChat.mock.calls[0][0];
    expect(startChatArg.history[0].role).toBe('user');
    expect(geminiMocks.sendMessage).toHaveBeenCalledWith('Necesito ayuda');
  });

  it('chatWithRocco devuelve fallback si falla', async () => {
    geminiMocks.sendMessage.mockRejectedValueOnce(new Error('fail'));
    await expect(chatWithRocco([{ role: 'user', content: 'Hola' }], 'system')).resolves.toEqual({
      text: 'Lo siento, estoy teniendo problemas para procesar tu mensaje. ¡Intentá de nuevo más tarde!',
    });
  });
});
