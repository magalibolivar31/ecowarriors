import { describe, expect, it } from 'vitest';
import { Report, ReportUpdate, Squad, UserSettings } from '../types';
import { calculateMissionProgress } from './missionProgress';

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

function makeUpdate(overrides: Partial<ReportUpdate> = {}): ReportUpdate {
  return {
    id: 'update-id',
    createdAt: {} as any,
    createdBy: 'user-1',
    createdByName: 'EcoWarrior',
    description: 'Actualización',
    newStatus: 'Abierto (en seguimiento)',
    imageUrl: null,
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

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    uid: 'user-1',
    onboardingCompleted: false,
    crisisRemindersEnabled: true,
    meetingPoint: { place: '' },
    trustedContacts: [],
    ...overrides,
  };
}

describe('calculateMissionProgress', () => {
  it('deja todas las misiones disponibles cuando no hay actividad', () => {
    const missions = calculateMissionProgress({
      userReports: [],
      allReports: [],
      userUpdates: [],
      userSquads: [],
      userSettings: null,
    });

    missions.forEach((mission) => {
      expect(mission.progress).toBe(0);
      expect(mission.status).toBe('available');
    });
  });

  it('marca todas las misiones como completadas en un flujo completo', () => {
    const userReport = makeReport({ id: 'u-report', initialImageUrl: 'https://img.test' });
    const allReports = Array.from({ length: 11 }, (_, i) =>
      makeReport({ id: i === 10 ? 'u-report' : `report-${i}` }),
    );
    const userUpdates = [makeUpdate({ newStatus: 'Resuelto', imageUrl: 'https://evidence.test' })];
    const userSquads = [makeSquad()];
    const userSettings = makeSettings({
      onboardingCompleted: true,
      trustedContacts: [{ name: 'Ana', phone: '+5491112345678' }],
    });

    const missions = calculateMissionProgress({
      userReports: [userReport],
      allReports,
      userUpdates,
      userSquads,
      userSettings,
    });

    missions.forEach((mission) => {
      expect(mission.progress).toBe(100);
      expect(mission.status).toBe('completed');
    });
  });

  it('marca progreso parcial cuando hay actividad incompleta', () => {
    const userReport = makeReport({ id: 'old-user-report', initialImageUrl: null });
    const allReports = [
      userReport,
      ...Array.from({ length: 10 }, (_, i) => makeReport({ id: `new-report-${i}` })),
    ];

    const missions = calculateMissionProgress({
      userReports: [userReport],
      allReports,
      userUpdates: [],
      userSquads: [],
      userSettings: makeSettings({ onboardingCompleted: true, trustedContacts: [] }),
    });

    const missionById = Object.fromEntries(missions.map((mission) => [mission.id, mission]));

    expect(missionById['primer-reporte'].progress).toBe(0);
    expect(missionById['ojo-aguila'].progress).toBe(50);
    expect(missionById['ojo-aguila'].status).toBe('in-progress');
    expect(missionById['prevencion-activa'].progress).toBe(50);
    expect(missionById['prevencion-activa'].status).toBe('in-progress');
  });
});
