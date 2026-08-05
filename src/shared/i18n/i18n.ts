/**
 * The translation runtime — one owner of initialization, of the active language, and of the two
 * side effects a language change has outside React.
 *
 * Initialization runs as a module side effect so that any component reaching `useTranslation`
 * finds a configured instance. The alternative — a provider that must be mounted first — makes
 * every test that renders a component in isolation responsible for i18n setup, which is a
 * failure mode rather than a boundary.
 *
 * Language changes propagate through each consumer's `useTranslation` subscription, so no context
 * of our own is needed; `useLanguage` is the read/write surface.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  resolveLanguage,
  type Language,
} from './locales';
import { DEFAULT_NAMESPACE, NAMESPACES, resources } from './resources';
import { readStoredLanguage, writeStoredLanguage } from './storage';

/**
 * The language the application boots in.
 *
 * A stored explicit choice wins; everything else — a first visit, an unreadable store, a value
 * that is no longer a supported language — resolves to the deterministic default. Browser
 * language is deliberately not consulted: see `locales.ts`.
 */
export function resolveInitialLanguage(): Language {
  return readStoredLanguage() ?? DEFAULT_LANGUAGE;
}

/** Keeps the document's declared language in step with the rendered language, for assistive
 * technology and for the browser's own text handling. Both product languages are left-to-right,
 * so `dir` is not touched. */
function applyDocumentLanguage(language: Language): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

let initialized = false;

/** Idempotent. Safe to call from the composition root, from a test, or not at all. */
export function initI18n(): typeof i18n {
  if (initialized) return i18n;
  initialized = true;

  void i18n.use(initReactI18next).init({
    resources,
    lng: resolveInitialLanguage(),
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    ns: NAMESPACES,
    defaultNS: DEFAULT_NAMESPACE,
    // React escapes interpolated values already; escaping twice would render `&#39;` to the user.
    interpolation: { escapeValue: false },
    returnNull: false,
    // Every resource is bundled, so nothing is ever loading and nothing needs to suspend.
    react: { useSuspense: false },
  });

  // Persist only on a real change: `init` does not emit this event, so a visitor who never chose
  // a language is never pinned to today's default.
  i18n.on('languageChanged', (next) => {
    const language = resolveLanguage(next);
    applyDocumentLanguage(language);
    writeStoredLanguage(language);
  });

  applyDocumentLanguage(resolveLanguage(i18n.language));

  return i18n;
}

initI18n();

/** The active language, always one of the supported set. */
export function getActiveLanguage(): Language {
  return resolveLanguage(i18n.language);
}

/** Changes the UI language. Normalizes first, so an unsupported value cannot be applied. */
export function changeLanguage(language: string): Promise<unknown> {
  return i18n.changeLanguage(resolveLanguage(language)) as Promise<unknown>;
}

export { i18n };
