/**
 * Localization foundation — the public entrypoint for everything language-related.
 *
 * Boundary (enforced by `src/app/architecture/import-boundaries.test.ts`): this package depends on
 * React, i18next and other `shared/` modules only. Features import `useTranslation` and `Trans`
 * from here rather than from `react-i18next` directly, so the translation library has exactly one
 * seam in the codebase.
 *
 * Importing this module initializes i18next — see `i18n.ts` for why that is a side effect rather
 * than a provider.
 *
 * To add copy for a feature: add the keys to its namespace file under `resources/`, in both `en`
 * and `vi` (TypeScript will not compile until both exist), then read them with
 * `useTranslation('<namespace>')`.
 */
export { useTranslation, Trans } from 'react-i18next';

export {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  FORMATTING_LOCALES,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  formattingLocaleFor,
  isLanguage,
  resolveLanguage,
  type Language,
} from './locales';

export { LANGUAGE_STORAGE_KEY, readStoredLanguage, writeStoredLanguage } from './storage';

export {
  changeLanguage,
  getActiveLanguage,
  i18n,
  initI18n,
  resolveInitialLanguage,
} from './i18n';

export { useDateTimeFormat, useLanguage, type LanguageControl } from './use-language';

export { LanguageSelect } from './language-select';

export { DEFAULT_NAMESPACE, NAMESPACES, type Namespace } from './resources';

export type { TranslationKey } from './keys';
