/**
 * Error-feedback adapter — the one place an unknown error becomes safe presentation copy.
 *
 * It applies the existing user-safe error-copy policy (raw backend diagnostics never surface)
 * and renders the pure `ErrorBanner` primitive. Direction stays one-way: shared/feedback may
 * import shared/api and shared/ui; shared/ui never imports back.
 */
import { getUserSafeErrorCopy } from '../api/user-error-copy';
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
  const copy = getUserSafeErrorCopy(error);

  return (
    <ErrorBanner
      title={title ?? copy.title}
      message={message ?? copy.message}
      detail={detail}
      className={className}
    />
  );
}
