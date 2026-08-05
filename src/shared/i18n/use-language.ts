/**
 * React surface for the active language: reading it, changing it, and formatting against it.
 *
 * Both hooks subscribe through `useTranslation`, so a language change re-renders every consumer
 * without a bespoke context.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createDateTimeFormatter } from '../format';
import { changeLanguage } from './i18n';
import { formattingLocaleFor, resolveLanguage, type Language } from './locales';

export type LanguageControl = {
  /** The active product language. */
  language: Language;
  /** The `Intl` locale the active language formats against — `en-US` or `vi-VN`. */
  formattingLocale: string;
  /** Applies and persists a language. An unsupported value normalizes rather than being applied. */
  setLanguage: (language: Language) => void;
};

export function useLanguage(): LanguageControl {
  const { i18n } = useTranslation();
  const language = resolveLanguage(i18n.language);

  return {
    language,
    formattingLocale: formattingLocaleFor(language),
    setLanguage: (next) => void changeLanguage(next),
  };
}

/**
 * Date and time formatted in the active language.
 *
 * A record with no usable timestamp reads as the localized "unknown" rather than an empty cell —
 * the frontend never invents a date it was not given.
 *
 * Media timestamps are deliberately not routed through here: `mm:ss` is the same in both
 * languages and belongs to `entities/transcript`.
 */
export function useDateTimeFormat(): (value: string | null | undefined) => string {
  const { t, i18n } = useTranslation('common');
  const locale = formattingLocaleFor(resolveLanguage(i18n.language));

  return useMemo(() => {
    const format = createDateTimeFormatter(locale);
    return (value) => format(value) ?? t('unknownDateTime');
  }, [locale, t]);
}
