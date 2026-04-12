import { describe, expect, it } from 'vitest';
import { ceilToSeconds, consumeRoccoChatQuota } from './roccoRateLimit';

function createStorage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem: (_key: string) => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
    readRaw: () => value,
  };
}

describe('roccoRateLimit', () => {
  it('permite el primer mensaje y lo persiste', () => {
    const storage = createStorage();
    const result = consumeRoccoChatQuota(1_000, storage);

    expect(result).toEqual({ allowed: true });
    expect(storage.readRaw()).toContain('"timestamps":[1000]');
  });

  it('bloquea mensajes demasiado seguidos', () => {
    const storage = createStorage('{"timestamps":[1000],"lastSentAt":1000}');
    const result = consumeRoccoChatQuota(2_000, storage);

    expect(result.allowed).toBe(false);
    if (result.allowed === false) {
      expect(result.waitMs).toBe(2_000);
    }
  });

  it('bloquea cuando supera el máximo por ventana', () => {
    const now = 10_000;
    const timestamps = [1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 7_000, 8_000];
    const storage = createStorage(JSON.stringify({ timestamps, lastSentAt: 6_000 }));
    const result = consumeRoccoChatQuota(now, storage);

    expect(result.allowed).toBe(false);
    if (result.allowed === false) {
      expect(result.waitMs).toBe(51_000);
    }
  });

  it('maneja estado corrupto y se recupera', () => {
    const storage = createStorage('{bad json}');
    const result = consumeRoccoChatQuota(5_000, storage);

    expect(result).toEqual({ allowed: true });
    expect(storage.readRaw()).toContain('"lastSentAt":5000');
  });

  it('ceilToSeconds redondea hacia arriba', () => {
    expect(ceilToSeconds(1_001)).toBe(2);
  });
});
