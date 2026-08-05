/**
 * The language registry — the single owner of which languages the product ships.
 *
 * Two identifiers are deliberately kept apart:
 *  - the **product language** (`en` / `vi`) keys the translation resources, the stored preference
 *    and the document `lang` attribute. It has no region, because the product does not ship a
 *    regional variant of either language;
 *  - the **formatting locale** (`en-US` / `vi-VN`) is what `Intl` needs to resolve month names,
 *    number grouping and date order. A bare `vi` resolves in every current browser, but the
 *    regional tag is what the formatters are actually specified against, so it is explicit here.
 *
 * Adding a language means adding it here and adding its half of every resource namespace; the
 * resource types then refuse to compile until every key exists.
 */

export const SUPPORTED_LANGUAGES = ['en', 'vi'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * First-visit language, and the language every unresolvable preference falls back to.
 *
 * Deliberately deterministic rather than browser-derived: the product's own copy is authored in
 * English, so an English first paint is the one outcome that is always fully translated. Browser
 * detection would trade that guarantee for a guess about two languages.
 */
export const DEFAULT_LANGUAGE: Language = 'en';

/** i18next resolves a missing key against this language before it gives up and returns the key. */
export const FALLBACK_LANGUAGE: Language = DEFAULT_LANGUAGE;

/** Endonyms — a language is named in its own language, never translated and never a flag. */
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

/** BCP-47 tag handed to `Intl` for each product language. */
export const FORMATTING_LOCALES: Record<Language, string> = {
  en: 'en-US',
  vi: 'vi-VN',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Normalises any raw preference to a supported language.
 *
 * BCP-47 tags are case-insensitive and may carry a region, so `EN`, `en-GB` and `en` all mean
 * English. Anything else — a removed language, a corrupted storage value, `null` — resolves to the
 * default rather than leaving the UI on an unknown language.
 */
export function resolveLanguage(value: string | null | undefined): Language {
  if (!value) return DEFAULT_LANGUAGE;

  const normalized = value.trim().toLowerCase();
  if (isLanguage(normalized)) return normalized;

  const base = normalized.split('-')[0] ?? '';
  return isLanguage(base) ? base : DEFAULT_LANGUAGE;
}

export function formattingLocaleFor(language: Language): string {
  return FORMATTING_LOCALES[language];
}
