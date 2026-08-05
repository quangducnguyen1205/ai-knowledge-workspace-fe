/**
 * The language control.
 *
 * It lives with the i18n foundation rather than in `shared/ui`, because its contract is the
 * language registry, not a design-system primitive: adding a language to `locales.ts` surfaces it
 * here with no change to this file. It reuses the application's existing `field` classes, the
 * same ones the Workspace switcher uses, so it introduces no new visual vocabulary.
 *
 * Accessibility: a native `<select>` is keyboard-operable and announces the current selection
 * without any bespoke behavior. Each option is tagged with its own `lang` so assistive technology
 * pronounces the endonym in that language. Language is never represented by a flag — a flag names
 * a country, not a language.
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, isLanguage } from './locales';
import { useLanguage } from './use-language';

export function LanguageSelect({
  id,
  hideLabel = false,
  className,
}: {
  id?: string;
  /** Hides the label visually while keeping it as the control's accessible name. */
  hideLabel?: boolean;
  className?: string;
}) {
  const { t } = useTranslation('settings');
  const { language, setLanguage } = useLanguage();
  const generatedId = useId();
  const selectId = id ?? `language-select-${generatedId}`;

  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label className={hideLabel ? 'visually-hidden' : 'field__label'} htmlFor={selectId}>
        {t('language.label')}
      </label>
      <select
        id={selectId}
        className="field__input"
        value={language}
        onChange={(event) => {
          if (isLanguage(event.target.value)) setLanguage(event.target.value);
        }}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LANGUAGE_LABELS[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
