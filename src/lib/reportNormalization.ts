import { ReportLocation, ReportStatus } from '../types';

export const VALID_REPORT_STATUSES: ReportStatus[] = [
  'Abierto (nuevo)',
  'Abierto (en seguimiento)',
  'Abierto (agravado)',
  'Resuelto',
  'Cancelado',
  'Cargado por error',
];

const TERMINAL_REPORT_STATUSES: ReportStatus[] = ['Resuelto', 'Cancelado', 'Cargado por error'];

export function isValidReportStatus(status: unknown): status is ReportStatus {
  return typeof status === 'string' && VALID_REPORT_STATUSES.includes(status as ReportStatus);
}

export function normalizeReportStatus(status: unknown): ReportStatus {
  if (isValidReportStatus(status)) return status;

  const statusStr = String(status || '').toLowerCase();

  if (!status || statusStr.includes('abierto')) return 'Abierto (nuevo)';
  if (statusStr.includes('resuelto')) return 'Resuelto';
  if (statusStr.includes('cancelado') || statusStr.includes('error')) {
    return statusStr.includes('cancelado') ? 'Cancelado' : 'Cargado por error';
  }
  return 'Abierto (nuevo)';
}

export function isActiveReportStatus(status: ReportStatus): boolean {
  return !TERMINAL_REPORT_STATUSES.includes(status);
}

type LocationInput = {
  location?: { lat?: unknown; lng?: unknown } | null;
  coords?: { lat?: unknown; lng?: unknown } | null;
  lat?: unknown;
  lng?: unknown;
};

function getNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export function normalizeReportLocation(data: LocationInput): ReportLocation {
  const loc = data?.location || {};
  const coords = data?.coords || {};

  // Priority 1: location.lat/lng
  let lat = getNumberOrNull(loc.lat);
  let lng = getNumberOrNull(loc.lng);

  // Priority 2: coords.lat/lng
  if (lat === null || lng === null) {
    lat = getNumberOrNull(coords.lat);
    lng = getNumberOrNull(coords.lng);
  }

  // Priority 3: lat/lng at root
  if (lat === null || lng === null) {
    lat = getNumberOrNull(data?.lat);
    lng = getNumberOrNull(data?.lng);
  }

  return {
    lat: lat || 0,
    lng: lng || 0,
  };
}
