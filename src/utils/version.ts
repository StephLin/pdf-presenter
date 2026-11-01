import pkg from '../../package.json';
import { isTauri } from '@tauri-apps/api/core';

/**
 * Base application name.
 */
export const APP_NAME = 'PDF Presenter';

/**
 * Canonical application version defined in `package.json`.
 */
export const APP_VERSION: string = pkg.version;

/**
 * Formats a semantic version string with a leading `v` prefix (e.g., `v1.0.0`).
 */
export function formatAppVersion(version: string = APP_VERSION): string {
  const clean = version.trim().replace(/^v/i, '');
  return `v${clean}`;
}

/**
 * Formats the full application display name with version (e.g., `PDF Presenter v1.0.0`).
 */
export function getAppDisplayName(version: string = APP_VERSION): string {
  return `${APP_NAME} ${formatAppVersion(version)}`;
}

/**
 * Resolves the application version at runtime (queries Tauri native metadata when running
 * inside the desktop shell, falling back to `package.json` version).
 */
export async function resolveAppVersion(): Promise<string> {
  if (isTauri()) {
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      const nativeVersion = await getVersion();
      if (nativeVersion) {
        return nativeVersion;
      }
    } catch {
      // Fallback to package.json version
    }
  }
  return APP_VERSION;
}
