import { describe, expect, it } from 'vitest';
import { calculateLevel, getLevelProgress } from './levelUtils';

describe('calculateLevel', () => {
  it('calcula correctamente cada umbral de nivel', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(299)).toBe(2);
    expect(calculateLevel(300)).toBe(3);
    expect(calculateLevel(599)).toBe(3);
    expect(calculateLevel(600)).toBe(4);
    expect(calculateLevel(999)).toBe(4);
    expect(calculateLevel(1000)).toBe(5);
    expect(calculateLevel(10000)).toBe(5);
  });
});

describe('getLevelProgress', () => {
  it('devuelve progreso correcto dentro de un nivel intermedio', () => {
    expect(getLevelProgress(150, 2)).toEqual({
      progress: 25,
      nextLevelXP: 300,
      xpRemaining: 150,
    });
  });

  it('controla progreso de nivel máximo sin NaN', () => {
    expect(getLevelProgress(1500, 5)).toEqual({
      progress: 100,
      nextLevelXP: 1000,
      xpRemaining: 0,
    });
  });

  it('normaliza niveles fuera de rango', () => {
    expect(getLevelProgress(50, 0)).toEqual({
      progress: 50,
      nextLevelXP: 100,
      xpRemaining: 50,
    });
  });
});
