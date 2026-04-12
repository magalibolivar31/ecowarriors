import { describe, expect, it } from 'vitest';
import { Report, Squad } from '../types';
import { calculateAchievements } from './achievementService';

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report-id',
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

function makeSquad(overrides: Partial<Squad> = {}): Squad {
  return {
    id: 'squad-id',
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

describe('calculateAchievements', () => {
  it('no devuelve logros sin actividad', () => {
    expect(calculateAchievements([], [])).toEqual([]);
  });

  it('desbloquea todos los logros cuando se cumplen los criterios', () => {
    const reports: Report[] = [
      makeReport({ id: 'r1', currentStatus: 'Resuelto', aiAnalysis: { categoria: 'Plástico', subcategorias: [], volumenEstimado: '', nivelUrgencia: 3, analisis: '' } }),
      makeReport({ id: 'r2', type: 'crisis', aiAnalysis: { categoria: 'Orgánico', subcategorias: [], volumenEstimado: '', nivelUrgencia: 2, analisis: '' } }),
      makeReport({ id: 'r3', aiAnalysis: { categoria: 'Escombros', subcategorias: [], volumenEstimado: '', nivelUrgencia: 1, analisis: '' } }),
      makeReport({ id: 'r4' }),
      makeReport({ id: 'r5' }),
    ];

    const squads: Squad[] = [makeSquad({ id: 's1' }), makeSquad({ id: 's2' }), makeSquad({ id: 's3' })];

    const achievements = calculateAchievements(reports, squads);
    const ids = achievements.map((achievement) => achievement.id);

    expect(ids).toEqual([
      'first-report',
      'problem-solver',
      'community-hero',
      'active-guardian',
      'crisis-responder',
      'squad-leader',
      'environmental-expert',
    ]);
  });

  it('no cuenta categorías vacías para experto ambiental', () => {
    const reports: Report[] = [
      makeReport({ aiAnalysis: { categoria: 'Plástico', subcategorias: [], volumenEstimado: '', nivelUrgencia: 1, analisis: '' } }),
      makeReport({ aiAnalysis: undefined }),
      makeReport({ aiAnalysis: { categoria: 'Plástico', subcategorias: [], volumenEstimado: '', nivelUrgencia: 1, analisis: '' } }),
    ];

    const achievements = calculateAchievements(reports, []);
    expect(achievements.find((achievement) => achievement.id === 'environmental-expert')).toBeUndefined();
  });
});
