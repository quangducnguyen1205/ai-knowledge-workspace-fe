/**
 * Error-feedback adapter — the one place an unknown error becomes safe presentation copy.
 *
 * It applies the existing user-safe error-copy policy (raw backend diagnostics never surface),
 * resolves the resulting keys against the active language, and renders the pure `ErrorBanner`
 * primitive. Direction stays one-way: shared/feedback may import shared/api, shared/i18n and
 * shared/ui; shared/ui never imports back.
 *
 * A caller that already has better copy passes it in already translated; the mapping is only the
 * fallback for an error nobody localized by hand.
 */
import { getUserSafeErrorCopy } from '../api/user-error-copy';
import { useTranslation } from '../i18n';
import { ErrorBanner } from '../ui';

export function ErrorFeedback({
  error,
  title,
  message,
  detail,
  className,
}: {
  error: unknown;
  title?: string;
  message?: string;
  detail?: string;
  className?: string;
}) {
  const { t } = useTranslation(['common', 'errors']);
  const copy = getUserSafeErrorCopy(error);

  return (
    <ErrorBanner
      title={title ?? t(copy.titleKey)}
      message={message ?? t(copy.messageKey)}
      detail={detail}
      className={className}
    />
  );
}
