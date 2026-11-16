import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { ApiError, apiClient } from './api-client';

/**
 * M8: live location for a provider's ACTIVE job, including while the app is in
 * the background.
 *
 *  - Android keeps it alive with a foreground service (and its notification).
 *  - iOS uses the `location` background mode (enabled via the expo-location
 *    config plugin in app.json).
 *
 * Background permission is only ever requested from here, and this module is
 * only used by provider screens: customer flows never ask for it.
 *
 * Expo Router rule (SDK 58 docs): `TaskManager.defineTask` must run at module
 * scope, so this file is imported at the top of app/_layout.tsx. The task can
 * run with no React tree mounted, so it reads everything it needs from storage.
 */
export const JOB_LOCATION_TASK = 'weyro-active-job-location';
const ACTIVE_JOB_KEY = 'weyro_active_job_id';

/** Statuses meaning "this job is over / not yours" — keep sending would be pointless. */
const STOP_STATUSES = new Set([400, 403, 404]);

async function readActiveJobId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACTIVE_JOB_KEY);
  } catch {
    return null;
  }
}

async function writeActiveJobId(id: string | null): Promise<void> {
  try {
    if (id) await SecureStore.setItemAsync(ACTIVE_JOB_KEY, id);
    else await SecureStore.deleteItemAsync(ACTIVE_JOB_KEY);
  } catch {
    // Non-blocking: secure store may be unavailable on some platforms.
  }
}

/** The job the background task is currently reporting for (null when none). */
export async function getActiveJobId(): Promise<string | null> {
  return readActiveJobId();
}

export async function isJobLocationRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(JOB_LOCATION_TASK);
  } catch {
    return false;
  }
}

/** Stop background updates and forget the job. Safe to call when nothing is running. */
export async function stopJobLocationUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(JOB_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(JOB_LOCATION_TASK);
    }
  } catch {
    // Already stopped / task not registered.
  }
  await writeActiveJobId(null);
}

// Runs for every batch of locations, in the foreground or background.
TaskManager.defineTask(JOB_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  const jobId = await readActiveJobId();
  if (!jobId) {
    // Orphaned task (e.g. app data cleared): nothing to report for, so stop it.
    await stopJobLocationUpdates();
    return;
  }

  try {
    await apiClient(`/bookings/${jobId}/location`, {
      method: 'PATCH',
      body: JSON.stringify({
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
      }),
    });
  } catch (error) {
    // The job ended (400), was reassigned (403) or vanished (404): stop for good.
    // Network errors and 401s are transient — the next batch tries again.
    if (error instanceof ApiError && STOP_STATUSES.has(error.status)) {
      await stopJobLocationUpdates();
    }
  }
});

export type LocationPermissionResult = 'background' | 'foreground-only' | 'denied';

/**
 * Ask for the permissions a live job needs. Foreground first (required by both
 * OSes), then background ("Always" on iOS; on Android 11+ the system may send
 * the user to Settings). If only foreground is granted we still share location
 * while the app is open.
 */
export async function requestJobLocationPermissions(): Promise<LocationPermissionResult> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return 'denied';
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.granted ? 'background' : 'foreground-only';
}

export interface StartJobLocationResult {
  permission: LocationPermissionResult;
  /** True when the background task is running (only with background permission). */
  started: boolean;
}

/**
 * Start sharing the provider's location for `jobId`. Replaces any earlier job.
 * Must be called from a provider screen, in response to a user action.
 */
export async function startJobLocationUpdates(jobId: string): Promise<StartJobLocationResult> {
  const permission = await requestJobLocationPermissions();
  // The background task needs background permission. With foreground-only the
  // caller falls back to sharing while the app is open (watchPositionAsync).
  if (permission !== 'background') return { permission, started: false };

  await stopJobLocationUpdates();
  await writeActiveJobId(jobId);

  await Location.startLocationUpdatesAsync(JOB_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 45_000,
    distanceInterval: 100,
    // iOS: keep updating, and show the system's "using your location" indicator.
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    // Android: a foreground service (visible notification) keeps this alive in the
    // background; it is torn down if the user force-quits the app.
    foregroundService: {
      notificationTitle: 'Weyro job in progress',
      notificationBody: 'Sharing your live location with the customer until the job ends.',
      killServiceOnDestroy: true,
    },
  });
  return { permission, started: true };
}
