import type { PageAnnotations } from '../types/presentation';

const STORAGE_PREFIX = 'pdf_presenter_';

let memoryStorage: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Fallback to memory
  }
  return memoryStorage[key] || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fallback to memory
  }
  memoryStorage[key] = value;
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch {
    // Fallback to memory
  }
  delete memoryStorage[key];
}

export function getAnnotationsStorageKey(pdfName: string): string {
  return `${STORAGE_PREFIX}notes_${pdfName}`;
}

export function saveAnnotationsToStorage(
  pdfName: string,
  annotations: Record<number, PageAnnotations>
): void {
  try {
    const key = getAnnotationsStorageKey(pdfName);
    setStorageItem(key, JSON.stringify(annotations));
  } catch (err) {
    console.error('Failed to save annotations to storage:', err);
  }
}

export function loadAnnotationsFromStorage(
  pdfName: string
): Record<number, PageAnnotations> {
  try {
    const key = getAnnotationsStorageKey(pdfName);
    const data = getStorageItem(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load annotations from storage:', err);
  }
  return {};
}

export function clearAnnotationsFromStorage(pdfName: string): void {
  try {
    const key = getAnnotationsStorageKey(pdfName);
    removeStorageItem(key);
  } catch (err) {
    console.error('Failed to clear annotations from storage:', err);
  }
}

export interface UserPreferences {
  penWidth?: number;
  penColor?: string;
  highlighterWidth?: number;
  highlighterColor?: string;
  laserColor?: string;
  notesWindowMode?: 'popup' | 'drawer';
}

const PREFERENCES_KEY = `${STORAGE_PREFIX}user_preferences`;

export function saveUserPreferences(prefs: UserPreferences): void {
  try {
    const existing = loadUserPreferences();
    const merged = { ...existing, ...prefs };
    setStorageItem(PREFERENCES_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to save preferences to storage:', err);
  }
}

export function loadUserPreferences(): UserPreferences {
  try {
    const data = getStorageItem(PREFERENCES_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load preferences from storage:', err);
  }
  return {};
}

export interface LivePresentationSyncData {
  title: string;
  currentPdfName: string;
  page: number;
  numPages: number;
  notes: string;
  allNotes: Record<number, string>;
  blackScreen: boolean;
  whiteScreen: boolean;
  updatedAt: number;
}

export const LIVE_SYNC_STORAGE_KEY = `${STORAGE_PREFIX}live_sync`;

export function saveLivePresentationSync(data: LivePresentationSyncData): void {
  try {
    setStorageItem(LIVE_SYNC_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save live presentation sync data:', err);
  }
}

export function loadLivePresentationSync(): LivePresentationSyncData | null {
  try {
    const data = getStorageItem(LIVE_SYNC_STORAGE_KEY);
    if (data) {
      return JSON.parse(data) as LivePresentationSyncData;
    }
  } catch (err) {
    console.error('Failed to load live presentation sync data:', err);
  }
  return null;
}
