import { describe, expect, it } from 'vitest';
import { getValidationErrorKey } from './validation';

describe('getValidationErrorKey', () => {
  it('valida teléfonos inválidos', () => {
    expect(getValidationErrorKey('contact', 'abc123')).toBe('validation.phone_invalid');
    expect(getValidationErrorKey('vContact', '123')).toBe('validation.phone_invalid');
    expect(getValidationErrorKey('contact', '+54 11 1234 5678')).toBeNull();
  });

  it('valida longitud en campos de nombre', () => {
    expect(getValidationErrorKey('title', 'a')).toBe('validation.name_invalid');
    expect(getValidationErrorKey('vZone', 'Zona Norte')).toBeNull();
    expect(getValidationErrorKey('sLocation', 'X')).toBe('validation.name_invalid');
    expect(getValidationErrorKey('sLocation', 'Plaza San Martín')).toBeNull();
  });

  it('valida longitud en campos descriptivos', () => {
    expect(getValidationErrorKey('description', 'corto')).toBe('validation.description_min');
    expect(
      getValidationErrorKey('sDescription', 'Descripción suficientemente larga para validar'),
    ).toBeNull();
  });

  it('devuelve null para campos no mapeados', () => {
    expect(getValidationErrorKey('otroCampo', 'valor')).toBeNull();
  });
});
