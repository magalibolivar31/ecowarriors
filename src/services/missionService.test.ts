import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  currentUser: { uid: 'user-1' } as { uid: string } | null,
}));

const missionProgressMocks = vi.hoisted(() => ({
  calculateMissionProgress: vi.fn(),
}));

vi.mock('../firebase', () => ({
  auth: authState,
}));

vi.mock('../lib/missionProgress', () => ({
  calculateMissionProgress: missionProgressMocks.calculateMissionProgress,
}));

import { calculateMissions } from './missionService';

describe('missionService.calculateMissions', () => {
  beforeEach(() => {
    authState.currentUser = { uid: 'user-1' };
    missionProgressMocks.calculateMissionProgress.mockReset();
  });

  it('devuelve [] si no hay usuario autenticado', async () => {
    authState.currentUser = null;
    const result = await calculateMissions([], [], [], [], null);
    expect(result).toEqual([]);
    expect(missionProgressMocks.calculateMissionProgress).not.toHaveBeenCalled();
  });

  it('delega a calculateMissionProgress cuando hay usuario', async () => {
    const expected = [{ id: 'm1', progress: 100, status: 'completed' }];
    missionProgressMocks.calculateMissionProgress.mockReturnValue(expected);

    const result = await calculateMissions([] as any, [] as any, [] as any, [] as any, null);

    expect(missionProgressMocks.calculateMissionProgress).toHaveBeenCalledTimes(1);
    expect(result).toBe(expected);
  });

  it('captura errores y devuelve []', async () => {
    missionProgressMocks.calculateMissionProgress.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = await calculateMissions([] as any, [] as any, [] as any, [] as any, null);

    expect(result).toEqual([]);
  });
});
