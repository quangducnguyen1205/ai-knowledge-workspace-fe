import { useEffect, useRef, useState } from 'react';
import { isApiClientError } from '../../../shared/api/api-error';
import { Button, ErrorFeedback, InfoBanner } from '../../../lib/ui';
import { useTranslation } from '../../../shared/i18n';
import type { Workspace } from '../api/workspaces-api';

function deleteErrorKeys<
  Key extends 'deleteDefaultForbidden' | 'deleteNotEmpty' | 'deleteNotFound' | 'deleteOffline' | 'deleteFailed',
>(tone: 'warning' | 'error', key: Key) {
  return {
    tone,
    titleKey: `workspaces:errors.${key}.title`,
    messageKey: `workspaces:errors.${key}.message`,
  } as const;
}

function getDeleteErrorCopy(error: unknown) {
  if (!isApiClientError(error)) {
    return error ? deleteErrorKeys('error', 'deleteFailed') : null;
  }

  if (error.status === 409 && error.code === 'DEFAULT_WORKSPACE_DELETE_FORBIDDEN') {
    return deleteErrorKeys('warning', 'deleteDefaultForbidden');
  }

  if (error.status === 409 && error.code === 'WORKSPACE_NOT_EMPTY') {
    return deleteErrorKeys('warning', 'deleteNotEmpty');
  }

  if (error.status === 404) {
    return deleteErrorKeys('warning', 'deleteNotFound');
  }

  if (error.status === 0) {
    return deleteErrorKeys('error', 'deleteOffline');
  }

  return deleteErrorKeys('error', 'deleteFailed');
}

export function WorkspaceDeleteDialog({
  workspace,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}: {
  workspace: Workspace;
  isDeleting: boolean;
  error: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation(['workspaces', 'common']);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const errorCopy = getDeleteErrorCopy(error);
  const isBusy = isDeleting || hasSubmitted;

  useEffect(() => {
    cancelButtonRef.current?.focus();
    setHasSubmitted(false);
  }, [workspace.id]);

  useEffect(() => {
    if (error) {
      setHasSubmitted(false);
    }
  }, [error]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isBusy) {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBusy, onCancel]);

  function handleConfirm() {
    if (isBusy) {
      return;
    }

    setHasSubmitted(true);
    onConfirm();
  }

  return (
    <div className="workspace-delete-dialog__backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="workspace-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-delete-dialog-title"
        aria-describedby="workspace-delete-dialog-description"
      >
        <p className="workspace-delete-dialog__eyebrow">{t('deleteDialog.eyebrow')}</p>
        <h2 id="workspace-delete-dialog-title">{t('deleteDialog.title', { name: workspace.name })}</h2>
        <p id="workspace-delete-dialog-description">{t('deleteDialog.description')}</p>

        {errorCopy?.tone === 'warning' ? (
          <InfoBanner tone="warning" title={t(errorCopy.titleKey)} message={t(errorCopy.messageKey)} />
        ) : null}
        {errorCopy?.tone === 'error' ? (
          <ErrorFeedback error={error} title={t(errorCopy.titleKey)} message={t(errorCopy.messageKey)} />
        ) : null}

        <div className="workspace-delete-dialog__actions">
          <button ref={cancelButtonRef} type="button" className="button button--ghost" onClick={onCancel} disabled={isBusy}>
            {t('common:actions.cancel')}
          </button>
          <Button type="button" tone="secondary" onClick={handleConfirm} disabled={isBusy}>
            {isBusy ? t('common:actions.deleting') : t('manage.delete')}
          </Button>
        </div>
      </section>
    </div>
  );
}
