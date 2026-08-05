/** Generic display formatting, framework-free. Domain-specific formatting stays with its owner
 * (for example transcript timestamps in entities/transcript). */

/**
 * Builds a date-and-time formatter bound to one locale.
 *
 * The locale is an argument rather than the browser default, because the product language owns
 * how a date reads: a Vietnamese interface must not render English month names just because the
 * browser is configured in English. `shared/i18n` binds the active language to this.
 *
 * Returns `null` when there is no value to format, so the caller supplies its own localized
 * placeholder instead of this module inventing English copy. An unparseable value is passed
 * through unchanged rather than replaced — whatever the backend sent is more useful than a guess.
 */
export function createDateTimeFormatter(locale: string): (value: string | null | undefined) => string | null {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (value) => {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : formatter.format(date);
  };
}

export function formatScore(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a';
  }

  return value.toFixed(2);
}
