import { beforeEach, describe, expect, it, vi } from 'vitest';

const aiMocks = vi.hoisted(() => {
  const responseText = vi.fn();
  const generateContent = vi.fn();
  const getGenerativeModel = vi.fn();

  getGenerativeModel.mockReturnValue({
    generateContent,
  });

  generateContent.mockResolvedValue({
    response: {
      text: responseText,
    },
  });

  return {
    responseText,
    generateContent,
    getGenerativeModel,
  };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = aiMocks.getGenerativeModel;
  },
}));

import { analyzePollutionImage, summarizeFile } from './aiService';

describe('aiService', () => {
  beforeEach(() => {
    aiMocks.responseText.mockReset();
    aiMocks.generateContent.mockReset();
    aiMocks.getGenerativeModel.mockClear();

    aiMocks.generateContent.mockResolvedValue({
      response: {
        text: aiMocks.responseText,
      },
    });
  });

  it('summarizeFile devuelve texto generado', async () => {
    aiMocks.responseText.mockReturnValue('Resumen generado');

    const result = await summarizeFile('base64data', 'image/jpeg');

    expect(result).toBe('Resumen generado');
    expect(aiMocks.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-3-flash-preview' });
    expect(aiMocks.generateContent).toHaveBeenCalledTimes(1);
  });

  it('summarizeFile devuelve fallback de error si falla Gemini', async () => {
    aiMocks.generateContent.mockRejectedValueOnce(new Error('network'));

    const result = await summarizeFile('base64data', 'image/jpeg');

    expect(result).toBe('Error al generar el resumen.');
  });

  it('analyzePollutionImage parsea JSON exitosamente', async () => {
    aiMocks.responseText.mockReturnValue(
      JSON.stringify({
        category: 'Plástico',
        subcategories: ['botellas'],
        volumeRange: 'Bajo',
        urgencyLevel: 2,
        description: 'Residuos livianos',
      }),
    );

    const result = await analyzePollutionImage('imageb64');

    expect(result).toEqual({
      category: 'Plástico',
      subcategories: ['botellas'],
      volumeRange: 'Bajo',
      urgencyLevel: 2,
      description: 'Residuos livianos',
    });
  });

  it('analyzePollutionImage devuelve fallback si falla parseo/generación', async () => {
    aiMocks.responseText.mockReturnValue('not-json');

    const result = await analyzePollutionImage('imageb64');

    expect(result).toEqual({
      category: 'Otro',
      subcategories: ['No identificado'],
      volumeRange: 'Desconocido',
      urgencyLevel: 3,
      description: 'No se pudo realizar el análisis automático. Por favor, revisa manualmente.',
    });
  });
});
