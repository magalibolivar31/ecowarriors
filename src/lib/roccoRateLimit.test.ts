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

  it('normaliza estado con timestamps inválidos', () => {
    const storage = createStorage('{"timestamps":"invalid","lastSentAt":0}');
    const result = consumeRoccoChatQuota(5_000, storage);

    expect(result).toEqual({ allowed: true });
    expect(storage.readRaw()).toBe('{"timestamps":[5000],"lastSentAt":5000}');
  });

  it('normaliza lastSentAt inválido a 0', () => {
    const storage = createStorage('{"timestamps":[4500],"lastSentAt":"invalid"}');
    const result = consumeRoccoChatQuota(5_000, storage);

    expect(result).toEqual({ allowed: true });
    expect(storage.readRaw()).toBe('{"timestamps":[4500,5000],"lastSentAt":5000}');
  });

  it('poda timestamps viejos cuando bloquea por intervalo mínimo', () => {
    const storage = createStorage('{"timestamps":[1000,50000,70000],"lastSentAt":99000}');
    const result = consumeRoccoChatQuota(100000, storage);

    expect(result.allowed).toBe(false);
    if (result.allowed === false) {
      expect(result.waitMs).toBe(2_000);
    }
    expect(storage.readRaw()).toBe('{"timestamps":[50000,70000],"lastSentAt":99000}');
  });

  it('poda timestamps viejos cuando bloquea por límite de ventana', () => {
    const storage = createStorage(
      '{"timestamps":[1000,40001,40002,40003,40004,40005,40006,40007,40008],"lastSentAt":90000}',
    );
    const result = consumeRoccoChatQuota(100000, storage);

    expect(result.allowed).toBe(false);
    if (result.allowed === false) {
      expect(result.waitMs).toBe(1_000);
    }
    expect(storage.readRaw()).toBe(
      '{"timestamps":[40001,40002,40003,40004,40005,40006,40007,40008],"lastSentAt":90000}',
    );
  });

  it('ceilToSeconds redondea hacia arriba', () => {
    expect(ceilToSeconds(1_001)).toBe(2);
  });

  it('permite cuando no hay storage disponible', () => {
    expect(consumeRoccoChatQuota(1_000, null)).toEqual({ allowed: true });
    expect(consumeRoccoChatQuota(1_000)).toEqual({ allowed: true });
  });

  it('usa window.localStorage cuando existe en runtime', () => {
    const storage = createStorage();
    const previousWindow = (globalThis as any).window;
    (globalThis as any).window = { localStorage: storage };

    const result = consumeRoccoChatQuota(2_000);

    (globalThis as any).window = previousWindow;

    expect(result).toEqual({ allowed: true });
    expect(storage.readRaw()).toBe('{"timestamps":[2000],"lastSentAt":2000}');
  });
});
