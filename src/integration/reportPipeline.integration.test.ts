import { describe, expect, it } from 'vitest';
import { normalizeReportLocation, normalizeReportStatus } from '../lib/reportNormalization';
import { sanitizeText } from '../lib/utils';
import { getValidationErrorKey } from '../lib/validation';

describe('integración: pipeline de validación y normalización de reporte', () => {
  it('recorre validación de formulario + sanitización + normalización', () => {
    const rawDescription = '  <b>Basural</b> en esquina, asdf \n ';
    const cleanDescription = sanitizeText(rawDescription);

    const descriptionError = getValidationErrorKey('description', cleanDescription);
    const titleError = getValidationErrorKey('title', 'Basural Norte');
    const contactError = getValidationErrorKey('contact', '+54 11 2233 4455');

    const normalizedStatus = normalizeReportStatus('abierto pendiente');
    const normalizedLocation = normalizeReportLocation({
      location: { lat: null, lng: null },
      coords: { lat: -34.6037, lng: -58.3816 },
    });

    expect(cleanDescription).toBe('Basural en esquina, asdf');
    expect(descriptionError).toBeNull();
    expect(titleError).toBeNull();
    expect(contactError).toBeNull();
    expect(normalizedStatus).toBe('Abierto (nuevo)');
    expect(normalizedLocation).toEqual({ lat: -34.6037, lng: -58.3816 });
  });

  it('captura fallos de validación y fallbacks de normalización', () => {
    expect(getValidationErrorKey('contact', 'xx')).toBe('validation.phone_invalid');
    expect(getValidationErrorKey('title', 'a')).toBe('validation.name_invalid');
    expect(getValidationErrorKey('description', 'corto')).toBe('validation.description_min');

    expect(normalizeReportStatus('error al cargar')).toBe('Cargado por error');
    expect(normalizeReportLocation({})).toEqual({ lat: 0, lng: 0 });
  });
});
