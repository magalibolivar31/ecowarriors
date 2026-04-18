import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentLocation, geoErrorKey } from './geolocation';

// Minimal GeolocationPositionError mock
function makeGeoError(code: number): GeolocationPositionError {
  return {
    code,
    message: 'error',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

function makePosition(lat: number, lng: number): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as GeolocationPosition;
}

describe('geoErrorKey', () => {
  it('returns correct key for unsupported', () => {
    expect(geoErrorKey('unsupported')).toBe('geo.unsupported');
  });
  it('returns correct key for permission', () => {
    expect(geoErrorKey('permission')).toBe('geo.permission');
  });
  it('returns correct key for unavailable', () => {
    expect(geoErrorKey('unavailable')).toBe('geo.unavailable');
  });
  it('returns correct key for timeout', () => {
    expect(geoErrorKey('timeout')).toBe('geo.timeout');
  });
});

describe('getCurrentLocation', () => {
  const originalGeo = globalThis.navigator?.geolocation;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: originalGeo,
      configurable: true,
      writable: true,
    });
  });

  it('returns unsupported when navigator.geolocation is absent', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const result = await getCurrentLocation();
    expect(result.coords).toBeNull();
    expect(result.error).toBe('unsupported');
  });

  it('returns coords on success', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success(makePosition(40.7128, -74.006));
        },
      },
      configurable: true,
      writable: true,
    });
    const result = await getCurrentLocation();
    expect(result.error).toBeNull();
    expect(result.coords).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it('returns permission error on PERMISSION_DENIED', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_: PositionCallback, error: PositionErrorCallback) => {
          error(makeGeoError(1)); // PERMISSION_DENIED
        },
      },
      configurable: true,
      writable: true,
    });
    const result = await getCurrentLocation();
    expect(result.coords).toBeNull();
    expect(result.error).toBe('permission');
  });

  it('returns unavailable on POSITION_UNAVAILABLE', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_: PositionCallback, error: PositionErrorCallback) => {
          error(makeGeoError(2)); // POSITION_UNAVAILABLE
        },
      },
      configurable: true,
      writable: true,
    });
    const result = await getCurrentLocation();
    expect(result.coords).toBeNull();
    expect(result.error).toBe('unavailable');
  });

  it('retries with high accuracy on timeout and returns coords on second attempt', async () => {
    let callCount = 0;
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: (
          success: PositionCallback,
          error: PositionErrorCallback,
          options?: PositionOptions,
        ) => {
          callCount++;
          if (!options?.enableHighAccuracy) {
            // First call: low accuracy → timeout
            error(makeGeoError(3)); // TIMEOUT
          } else {
            // Second call: high accuracy → success
            success(makePosition(51.505, -0.09));
          }
        },
      },
      configurable: true,
      writable: true,
    });
    const result = await getCurrentLocation();
    expect(callCount).toBe(2);
    expect(result.error).toBeNull();
    expect(result.coords).toEqual({ lat: 51.505, lng: -0.09 });
  });

  it('retries with high accuracy on timeout and returns error if second also fails', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: (
          _: PositionCallback,
          error: PositionErrorCallback,
          options?: PositionOptions,
        ) => {
          if (!options?.enableHighAccuracy) {
            error(makeGeoError(3)); // TIMEOUT → trigger retry
          } else {
            error(makeGeoError(2)); // POSITION_UNAVAILABLE on retry
          }
        },
      },
      configurable: true,
      writable: true,
    });
    const result = await getCurrentLocation();
    expect(result.coords).toBeNull();
    expect(result.error).toBe('unavailable');
  });
});
