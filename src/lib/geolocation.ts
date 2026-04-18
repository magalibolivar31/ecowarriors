export type GeoCoords = { lat: number; lng: number };

export type GeoError =
  | 'unsupported'   // navigator.geolocation not available
  | 'permission'    // user denied
  | 'unavailable'   // GPS/network unavailable
  | 'timeout';      // took too long

export type GeoResult =
  | { ok: true; coords: GeoCoords }
  | { ok: false; error: GeoError };

/**
 * Wraps navigator.geolocation.getCurrentPosition in a Promise.
 * Tries low-accuracy first (fast, works on desktop); if that times
 * out it retries with high-accuracy (better for mobile outdoors).
 */
export function getCurrentLocation(): Promise<GeoResult> {
  if (!navigator.geolocation) {
    return Promise.resolve({ ok: false, error: 'unsupported' });
  }

  const attempt = (highAccuracy: boolean): Promise<GeoResult> =>
    new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            ok: true,
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          }),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            resolve({ ok: false, error: 'permission' });
          } else if (err.code === err.TIMEOUT) {
            resolve({ ok: false, error: 'timeout' });
          } else {
            resolve({ ok: false, error: 'unavailable' });
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: 10000,
          maximumAge: 30000,
        },
      );
    });

  // Low-accuracy first (faster on desktop / WiFi).
  // On timeout only, retry with high-accuracy (outdoor mobile).
  return attempt(false).then((result) => {
    if (!result.ok && result.error === 'timeout') {
      return attempt(true);
    }
    return result;
  });
}

export function geoErrorKey(error: GeoError): string {
  switch (error) {
    case 'unsupported': return 'geo.unsupported';
    case 'permission':  return 'geo.permission';
    case 'unavailable': return 'geo.unavailable';
    case 'timeout':     return 'geo.timeout';
  }
}
