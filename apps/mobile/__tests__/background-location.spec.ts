/* global jest, describe, it, expect, beforeEach */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { ApiError, apiClient } from '../src/services/api-client';
// jest hoists the jest.mock calls below above these imports, so the module-scope
// TaskManager.defineTask call in the service is captured by the mock.
import {
  JOB_LOCATION_TASK,
  getActiveJobId,
  requestJobLocationPermissions,
  startJobLocationUpdates,
  stopJobLocationUpdates,
} from '../src/services/background-location';

type TaskExecutor = (body: { data?: unknown; error?: unknown }) => Promise<void>;
let taskExecutor: TaskExecutor;

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
  };
});

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(false),
}));

jest.mock('../src/services/api-client', () => {
  const actual = jest.requireActual('../src/services/api-client');
  return { ...actual, apiClient: jest.fn() };
});

const loc = Location as unknown as Record<string, jest.Mock>;
const mockedApi = apiClient as jest.MockedFunction<typeof apiClient>;

// The task is defined once, when the module loads.
const defineCall = (TaskManager.defineTask as jest.Mock).mock.calls[0];
taskExecutor = defineCall[1];

const grant = (foreground: boolean, background: boolean) => {
  loc.requestForegroundPermissionsAsync.mockResolvedValue({ granted: foreground });
  loc.requestBackgroundPermissionsAsync.mockResolvedValue({ granted: background });
};

describe('background job location (M8)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    loc.hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    await stopJobLocationUpdates();
    jest.clearAllMocks();
  });

  it('registers the task at module scope (required by Expo Router + TaskManager)', () => {
    expect(defineCall[0]).toBe(JOB_LOCATION_TASK);
    expect(typeof taskExecutor).toBe('function');
  });

  describe('permissions', () => {
    it('asks for foreground FIRST, then background', async () => {
      grant(true, true);
      expect(await requestJobLocationPermissions()).toBe('background');
      expect(loc.requestForegroundPermissionsAsync.mock.invocationCallOrder[0]).toBeLessThan(
        loc.requestBackgroundPermissionsAsync.mock.invocationCallOrder[0],
      );
    });

    it('never asks for background when foreground is denied', async () => {
      grant(false, true);
      expect(await requestJobLocationPermissions()).toBe('denied');
      expect(loc.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('reports foreground-only when background is refused', async () => {
      grant(true, false);
      expect(await requestJobLocationPermissions()).toBe('foreground-only');
    });
  });

  describe('start', () => {
    it('starts a foreground-service-backed task for the job', async () => {
      grant(true, true);
      const result = await startJobLocationUpdates('job-1');

      expect(result).toEqual({ permission: 'background', started: true });
      expect(loc.startLocationUpdatesAsync).toHaveBeenCalledWith(
        JOB_LOCATION_TASK,
        expect.objectContaining({
          accuracy: 3,
          timeInterval: 45_000,
          distanceInterval: 100,
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          foregroundService: expect.objectContaining({
            notificationTitle: expect.any(String),
            notificationBody: expect.stringContaining('live location'),
            killServiceOnDestroy: true,
          }),
        }),
      );
      expect(await getActiveJobId()).toBe('job-1');
    });

    it('does not start the background task without background permission', async () => {
      grant(true, false);
      expect(await startJobLocationUpdates('job-1')).toEqual({ permission: 'foreground-only', started: false });
      expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled();
      expect(await getActiveJobId()).toBeNull();
    });

    it('does nothing when location is denied outright', async () => {
      grant(false, false);
      expect(await startJobLocationUpdates('job-1')).toEqual({ permission: 'denied', started: false });
      expect(loc.startLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('replaces an earlier job instead of running two tasks', async () => {
      grant(true, true);
      await startJobLocationUpdates('job-1');
      loc.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
      await startJobLocationUpdates('job-2');

      expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
      expect(await getActiveJobId()).toBe('job-2');
    });
  });

  describe('stop', () => {
    it('stops the task and forgets the job', async () => {
      grant(true, true);
      await startJobLocationUpdates('job-1');
      loc.hasStartedLocationUpdatesAsync.mockResolvedValue(true);

      await stopJobLocationUpdates();

      expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledWith(JOB_LOCATION_TASK);
      expect(await getActiveJobId()).toBeNull();
    });

    it('is safe when nothing is running', async () => {
      loc.hasStartedLocationUpdatesAsync.mockResolvedValue(false);
      await expect(stopJobLocationUpdates()).resolves.toBeUndefined();
      expect(loc.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    });
  });

  describe('the background task', () => {
    const batch = (...coords: [number, number][]) => ({
      data: { locations: coords.map(([latitude, longitude]) => ({ coords: { latitude, longitude } })) },
    });

    beforeEach(async () => {
      grant(true, true);
      await startJobLocationUpdates('job-1');
      jest.clearAllMocks();
      loc.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    });

    it('reports the NEWEST location of a batch to the active job', async () => {
      mockedApi.mockResolvedValue({});
      await taskExecutor(batch([12.1, 77.1], [12.2, 77.2], [12.3, 77.3]));

      expect(mockedApi).toHaveBeenCalledTimes(1);
      expect(mockedApi).toHaveBeenCalledWith('/bookings/job-1/location', {
        method: 'PATCH',
        body: JSON.stringify({ latitude: 12.3, longitude: 77.3 }),
      });
    });

    it('ignores empty batches and task errors', async () => {
      await taskExecutor({ data: { locations: [] } });
      await taskExecutor({ error: new Error('boom') });
      expect(mockedApi).not.toHaveBeenCalled();
    });

    it.each([400, 403, 404])('stops for good when the server says the job is over (%i)', async (status) => {
      mockedApi.mockRejectedValue(new ApiError(status, 'Cannot share location for a completed booking'));
      await taskExecutor(batch([12.3, 77.3]));

      expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledWith(JOB_LOCATION_TASK);
      expect(await getActiveJobId()).toBeNull();
    });

    it.each([0, 401, 500])('keeps running through transient failures (%i)', async (status) => {
      mockedApi.mockRejectedValue(new ApiError(status, 'nope'));
      await taskExecutor(batch([12.3, 77.3]));

      expect(loc.stopLocationUpdatesAsync).not.toHaveBeenCalled();
      expect(await getActiveJobId()).toBe('job-1');
    });

    it('stops an orphaned task that has no job to report for', async () => {
      await stopJobLocationUpdates(); // clears the stored job but the OS task "still fires"
      loc.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
      jest.clearAllMocks();

      await taskExecutor(batch([12.3, 77.3]));

      expect(mockedApi).not.toHaveBeenCalled();
      expect(loc.stopLocationUpdatesAsync).toHaveBeenCalledWith(JOB_LOCATION_TASK);
    });
  });
});
