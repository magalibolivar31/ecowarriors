import { describe, expect, it } from 'vitest';
import { cn, sanitizeText } from './utils';

describe('cn', () => {
  it('combina clases y resuelve conflictos de Tailwind', () => {
    expect(cn('px-2', 'px-4', 'text-sm')).toBe('px-4 text-sm');
  });

  it('ignora valores falsy', () => {
    expect(cn('block', false && 'hidden', undefined, null)).toBe('block');
  });
});

describe('sanitizeText', () => {
  it('limpia HTML, protocolos peligrosos y espacios extra', () => {
    const result = sanitizeText('  <b>Hola</b>   mundo \n javascript:alert(1)  ');
    expect(result).toBe('Hola mundo alert(1)');
  });

  it('elimina data/vbscript y deja texto plano', () => {
    const result = sanitizeText('data:text/plain  vbscript:test  Mensaje');
    expect(result).toBe('text/plain test Mensaje');
  });

  it('devuelve string vacío cuando no hay input', () => {
    expect(sanitizeText('')).toBe('');
  });
});
