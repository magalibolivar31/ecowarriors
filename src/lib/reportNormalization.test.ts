import { describe, expect, it } from 'vitest';
import {
  isActiveReportStatus,
  isValidReportStatus,
  normalizeReportLocation,
  normalizeReportStatus,
} from './reportNormalization';

describe('normalizeReportStatus', () => {
  it('mantiene estados válidos', () => {
    expect(isValidReportStatus('Abierto (nuevo)')).toBe(true);
    expect(normalizeReportStatus('Abierto (en seguimiento)')).toBe('Abierto (en seguimiento)');
    expect(normalizeReportStatus('Resuelto')).toBe('Resuelto');
  });

  it('normaliza estados inválidos o ambiguos', () => {
    expect(normalizeReportStatus(undefined)).toBe('Abierto (nuevo)');
    expect(normalizeReportStatus('abierto de nuevo')).toBe('Abierto (nuevo)');
    expect(normalizeReportStatus('RESUELTO')).toBe('Resuelto');
    expect(normalizeReportStatus('cancelado por usuario')).toBe('Cancelado');
    expect(normalizeReportStatus('error de carga')).toBe('Cargado por error');
    expect(normalizeReportStatus('cualquier cosa')).toBe('Abierto (nuevo)');
  });
});

describe('isActiveReportStatus', () => {
  it('marca como inactivos los estados terminales', () => {
    expect(isActiveReportStatus('Resuelto')).toBe(false);
    expect(isActiveReportStatus('Cancelado')).toBe(false);
    expect(isActiveReportStatus('Cargado por error')).toBe(false);
    expect(isActiveReportStatus('Abierto (nuevo)')).toBe(true);
  });
});

describe('normalizeReportLocation', () => {
  it('prioriza location.lat/lng', () => {
    expect(
      normalizeReportLocation({
        location: { lat: -34.6, lng: -58.4 },
        coords: { lat: 1, lng: 1 },
        lat: 2,
        lng: 2,
      }),
    ).toEqual({ lat: -34.6, lng: -58.4 });
  });

  it('usa coords.lat/lng cuando location no es válida', () => {
    expect(
      normalizeReportLocation({
        location: { lat: 'x', lng: null },
        coords: { lat: 10, lng: 20 },
      }),
    ).toEqual({ lat: 10, lng: 20 });
  });

  it('usa lat/lng de raíz como tercer fallback', () => {
    expect(
      normalizeReportLocation({
        lat: -10,
        lng: 30,
      }),
    ).toEqual({ lat: -10, lng: 30 });
  });

  it('cae a 0,0 cuando no hay coordenadas útiles', () => {
    expect(normalizeReportLocation({})).toEqual({ lat: 0, lng: 0 });
    expect(normalizeReportLocation({ location: { lat: Number.NaN, lng: Number.NaN } })).toEqual({
      lat: 0,
      lng: 0,
    });
  });
});
