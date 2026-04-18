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

function attempt(highAccuracy: boolean): Promise<GeoResult> {
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
      { enableHighAccuracy: highAccuracy, timeout: 10000, maximumAge: 30000 },
    );
  });
}

/**
 * Wraps navigator.geolocation.getCurrentPosition in a Promise.
 * Tries low-accuracy first (fast on desktop/WiFi); retries with
 * high-accuracy only on timeout (better for outdoor mobile).
 */
export async function getCurrentLocation(): Promise<GeoResult> {
  if (!navigator.geolocation) {
    return { coords: null, error: 'unsupported' };
  }
  const first = await attempt(false);
  if (first.error === 'timeout') {
    return attempt(true);
  }
  return first;
}
