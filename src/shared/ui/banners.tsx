import { getUserSafeErrorCopy } from '../api/user-error-copy';
import { joinClassNames } from './class-names';

/** Bounded error feedback. Raw backend diagnostics never reach this surface. */
export function ErrorBanner({
  error,
  className,
  title,
  message,
  detail,
}: {
  error: unknown;
  className?: string;
  title?: string;
  message?: string;
  detail?: string;
}) {
  const copy = getUserSafeErrorCopy(error);
  const resolvedTitle = title ?? copy.title;
  const resolvedMessage = message ?? copy.message;

  return (
    <div className={joinClassNames('message message--error', className)} role="alert">
      <strong>{resolvedTitle}</strong>
      <p>{resolvedMessage}</p>
      {detail ? <small className="message__detail">{detail}</small> : null}
    </div>
  );
}

export function InfoBanner({
  title,
  message,
  className,
  tone = 'info',
  detail,
}: {
  title: string;
  message: string;
  className?: string;
  tone?: 'info' | 'success' | 'warning';
  detail?: string;
}) {
  return (
    <div className={joinClassNames('message', `message--${tone}`, className)}>
      <strong>{title}</strong>
      <p>{message}</p>
      {detail ? <small className="message__detail">{detail}</small> : null}
    </div>
  );
}

export function SuccessNotification({
  title,
  message,
  onDismiss,
  className,
}: {
  title: string;
  message: string;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <div
      className={joinClassNames('message', 'message--success', 'message--dismissible', className)}
      role="status"
      aria-live="polite"
    >
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <button
        type="button"
        className="message__dismiss"
        aria-label={`Dismiss ${title}`}
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}
