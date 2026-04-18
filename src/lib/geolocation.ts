export type GeoCoords = { lat: number; lng: number };

export type GeoError =
  | 'unsupported'
  | 'permission'
  | 'unavailable'
  | 'timeout';

// Plain object — no discriminated union, avoids narrowing issues without strict mode
export type GeoResult = { coords: GeoCoords; error: null } | { coords: null; error: GeoError };

export function geoErrorKey(error: GeoError): string {
  switch (error) {
    case 'unsupported': return 'geo.unsupported';
    case 'permission':  return 'geo.permission';
    case 'unavailable': return 'geo.unavailable';
    case 'timeout':     return 'geo.timeout';
  }
}

function attempt(highAccuracy: boolean, timeoutMs = 10000): Promise<GeoResult> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          error: null,
        }),
      (err) => {
        let error: GeoError;
        if (err.code === err.PERMISSION_DENIED) {
          error = 'permission';
        } else if (err.code === err.TIMEOUT) {
          error = 'timeout';
        } else {
          error = 'unavailable';
        }
        resolve({ coords: null, error });
      },
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

/**
 * Wraps navigator.geolocation.getCurrentPosition in a Promise.
 *
 * Strategy:
 *   1. Try low-accuracy (network/WiFi) with a 8 s timeout — fast on desktop and
 *      devices with cell/WiFi positioning.
 *   2. If that times out OR returns POSITION_UNAVAILABLE (common on Android when
 *      enableHighAccuracy is false but GPS is available), retry once with
 *      high-accuracy GPS and a 15 s timeout.
 *   3. PERMISSION_DENIED is returned immediately — a retry won't help.
 */
export async function getCurrentLocation(): Promise<GeoResult> {
  console.log('[geo] geolocation disponible:', !!navigator?.geolocation);
  console.log('[geo] protocol:', globalThis.location?.protocol ?? 'N/A');
  console.log('[geo] hostname:', globalThis.location?.hostname ?? 'N/A');

  if (!navigator.geolocation) {
    return { coords: null, error: 'unsupported' };
  }

  const first = await attempt(false, 8000);
  console.log('[geo] primer intento (low-accuracy):', first.error ?? 'ok', first.coords);

  if (first.error === 'timeout' || first.error === 'unavailable') {
    console.log('[geo] reintentando con high-accuracy GPS...');
    const second = await attempt(true, 15000);
    console.log('[geo] segundo intento (high-accuracy):', second.error ?? 'ok', second.coords);
    return second;
  }

  return first;
}
