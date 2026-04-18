import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCurrentLocation, geoErrorKey } from './geolocation';

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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns unsupported when navigator.geolocation is absent', async () => {
    vi.stubGlobal('navigator', {});
    const result = await getCurrentLocation();
    expect(result.coords).toBeNull();
    expect(result.error).toBe('unsupported');
  });

  it('returns coords on success', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success(makePosition(40.7128, -74.006));
        },
      },
    });
    const result = await getCurrentLocation();
    expect(result.error).toBeNull();
    expect(result.coords).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it('returns permission error on PERMISSION_DENIED', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_: PositionCallback, error: PositionErrorCallback) => {
          error(makeGeoError(1));
        },
      },
    });
    const result = await getCurrentLocation();
    expect(result.coords).toBeNull();
    expect(result.error).toBe('permission');
  });

  it('returns unavailable on POSITION_UNAVAILABLE', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_: PositionCallback, error: PositionErrorCallback) => {
          error(makeGeoError(2));
        },
      },
    });
    const result = await getCurrentLocation();
    expect(result.coords).toBeNull();
    expect(result.error).toBe('unavailable');
  });

  it('retries with high accuracy on timeout and returns coords on second attempt', async () => {
    let callCount = 0;
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (
          success: PositionCallback,
          error: PositionErrorCallback,
          options?: PositionOptions,
        ) => {
          callCount++;
          if (!options?.enableHighAccuracy) {
            error(makeGeoError(3)); // TIMEOUT → triggers retry
          } else {
            success(makePosition(51.505, -0.09));
          }
        },
      },
    });
    const result = await getCurrentLocation();
    expect(callCount).toBe(2);
    expect(result.error).toBeNull();
    expect(result.coords).toEqual({ lat: 51.505, lng: -0.09 });
  });

  it('retries with high accuracy on timeout and returns error if second also fails', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (
          _: PositionCallback,
          error: PositionErrorCallback,
          options?: PositionOptions,
        ) => {
          if (!options?.enableHighAccuracy) {
            error(makeGeoError(3)); // TIMEOUT → triggers retry
          } else {
            error(makeGeoError(2)); // POSITION_UNAVAILABLE on retry
          }
        },
      },
    });
    const result = await getCurrentLocation();
    expect(result.coords).toBeNull();
    expect(result.error).toBe('unavailable');
  });
});
