import { describe, expect, it } from 'vitest';
import { calculateLevel, getLevelProgress } from '../lib/levelUtils';
import { calculateMissionProgress } from '../lib/missionProgress';
import { Report, ReportUpdate, Squad, UserSettings } from '../types';
import { calculateAchievements } from '../services/achievementService';

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report',
    uid: 'user-1',
    type: 'ambiental',
    title: 'Título',
    description: 'Descripción',
    location: { lat: -34.6, lng: -58.4 },
    createdAt: {} as any,
    createdBy: 'user-1',
    createdByName: 'EcoWarrior',
    initialImageUrl: null,
    currentStatus: 'Abierto (nuevo)',
    isActive: true,
    ...overrides,
  };
}

function update(overrides: Partial<ReportUpdate> = {}): ReportUpdate {
  return {
    id: 'update',
    createdAt: {} as any,
    createdBy: 'user-1',
    createdByName: 'EcoWarrior',
    description: 'Actualización',
    newStatus: 'Abierto (en seguimiento)',
    imageUrl: null,
    ...overrides,
  };
}

function squad(overrides: Partial<Squad> = {}): Squad {
  return {
    id: 'squad',
    title: 'Cuadrilla',
    description: 'Descripción',
    date: '2026-04-12',
    time: '10:00',
    location: 'Plaza',
    attendees: ['user-1'],
    createdBy: 'user-1',
    createdAt: {} as any,
    status: 'próxima',
    ...overrides,
  };
}

describe('integración: progreso de usuario', () => {
  it('integra misiones, logros y nivel de forma consistente', () => {
    const reports = [
      report({
        id: 'r1',
        initialImageUrl: 'https://img.test',
        currentStatus: 'Resuelto',
        aiAnalysis: {
          categoria: 'Plástico',
          subcategorias: [],
          volumenEstimado: '',
          nivelUrgencia: 2,
          analisis: '',
        },
      }),
      report({
        id: 'r2',
        type: 'crisis',
        aiAnalysis: {
          categoria: 'Orgánico',
          subcategorias: [],
          volumenEstimado: '',
          nivelUrgencia: 3,
          analisis: '',
        },
      }),
      report({
        id: 'r3',
        aiAnalysis: {
          categoria: 'Escombros',
          subcategorias: [],
          volumenEstimado: '',
          nivelUrgencia: 1,
          analisis: '',
        },
      }),
      report({ id: 'r4' }),
      report({ id: 'r5' }),
    ];

    const allReports = [...Array.from({ length: 6 }, (_, i) => report({ id: `sys-${i}` })), ...reports];
    const updates = [update({ newStatus: 'Resuelto', imageUrl: 'https://evidence.test' })];
    const squads = [squad({ id: 's1' }), squad({ id: 's2' }), squad({ id: 's3' })];
    const settings: UserSettings = {
      uid: 'user-1',
      onboardingCompleted: true,
      crisisRemindersEnabled: true,
      meetingPoint: { place: 'Club del barrio' },
      trustedContacts: [{ name: 'Ana', phone: '+5491112345678' }],
    };

    const missions = calculateMissionProgress({
      userReports: reports,
      allReports,
      userUpdates: updates,
      userSquads: squads,
      userSettings: settings,
    });
    const achievements = calculateAchievements(reports, squads);

    const totalMissionXp = missions
      .filter((mission) => mission.status === 'completed')
      .reduce((acc, mission) => acc + mission.reward, 0);

    const level = calculateLevel(totalMissionXp);
    const levelProgress = getLevelProgress(totalMissionXp, level);

    expect(missions.every((mission) => mission.status === 'completed')).toBe(true);
    expect(achievements).toHaveLength(7);
    expect(level).toBeGreaterThanOrEqual(2);
    expect(levelProgress.progress).toBeGreaterThanOrEqual(0);
    expect(levelProgress.progress).toBeLessThanOrEqual(100);
  });
});
