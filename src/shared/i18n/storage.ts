/**
 * The one owner of language persistence.
 *
 * The stored value is a UI preference and nothing else — no session, no token, no account data —
 * so it is safe in `localStorage` and survives a reload and a fresh tab, which is the whole point.
 * Storage may be unavailable (private mode, a blocked origin, a quota-full profile); every access
 * therefore degrades to "no stored preference" instead of breaking the shell.
 *
 * The key follows the existing `akw:` convention, matching `akw:last-workspace-id`.
 */
import { isLanguage, resolveLanguage, type Language } from './locales';

export const LANGUAGE_STORAGE_KEY = 'akw:language';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The user's explicit choice, or `null` when nothing valid is stored.
 *
 * A value that is no longer a supported language is treated as absent rather than coerced, so a
 * removed language falls back to the default instead of silently becoming another language.
 */
export function readStoredLanguage(): Language | null {
  try {
    const raw = storage()?.getItem(LANGUAGE_STORAGE_KEY)?.trim().toLowerCase();
    return isLanguage(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredLanguage(language: Language): void {
  try {
    storage()?.setItem(LANGUAGE_STORAGE_KEY, resolveLanguage(language));
  } catch {
    // A blocked or full store must not break the language change; it applies for this session.
  }
}
