import { useTranslation } from '../i18n';
import { joinClassNames } from './class-names';

/**
 * Pure error presentation: it renders exactly the safe copy it is given and never inspects an
 * error object. Mapping an unknown error to bounded copy is the job of the shared/feedback
 * adapter, which keeps this primitive transport-neutral.
 */
export function ErrorBanner({
  title,
  message,
  detail,
  className,
}: {
  title: string;
  message: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={joinClassNames('message message--error', className)} role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
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
  // The notice itself is supplied by the caller; only this primitive's own control needs copy,
  // and it takes it from the localization layer rather than from a prop every caller would repeat.
  const { t } = useTranslation('common');

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
        aria-label={t('actions.dismissNotice', { title })}
        onClick={onDismiss}
      >
        {t('actions.dismiss')}
      </button>
    </div>
  );
}
