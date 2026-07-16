import { useEffect, useRef, useState } from 'react';
import { isApiClientError } from '../../../shared/api/api-error';
import { Button, ErrorBanner, InfoBanner } from '../../../lib/ui';
import type { Workspace } from '../api/workspaces-api';

type DeleteErrorCopy = {
  tone: 'warning' | 'error';
  title: string;
  message: string;
};

function getDeleteErrorCopy(error: unknown): DeleteErrorCopy | null {
  if (!isApiClientError(error)) {
    return error ? {
      tone: 'error',
      title: 'Could not delete workspace',
      message: 'The workspace was not deleted. Try again later.',
    } : null;
  }

  if (error.status === 409 && error.code === 'DEFAULT_WORKSPACE_DELETE_FORBIDDEN') {
    return {
      tone: 'warning',
      title: 'Default workspace cannot be deleted',
      message: 'The default workspace is protected.',
    };
  }

  if (error.status === 409 && error.code === 'WORKSPACE_NOT_EMPTY') {
    return {
      tone: 'warning',
      title: 'Workspace still contains videos',
      message: 'Delete its videos before trying again.',
    };
  }

  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Workspace not found',
      message: 'It no longer exists or you do not have access.',
    };
  }

  if (error.status === 0) {
    return {
      tone: 'error',
      title: 'Could not delete workspace',
      message: 'Check your connection and try again. The workspace was not deleted.',
    };
  }

  return {
    tone: 'error',
    title: 'Could not delete workspace',
    message: 'The workspace was not deleted. Try again later.',
  };
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
        <p className="workspace-delete-dialog__eyebrow">Confirm workspace deletion</p>
        <h2 id="workspace-delete-dialog-title">Delete “{workspace.name}”?</h2>
        <p id="workspace-delete-dialog-description">
          Only empty, non-default workspaces can be deleted. This action cannot be undone after the service confirms it.
        </p>

        {errorCopy?.tone === 'warning' ? (
          <InfoBanner tone="warning" title={errorCopy.title} message={errorCopy.message} />
        ) : null}
        {errorCopy?.tone === 'error' ? (
          <ErrorBanner error={error} title={errorCopy.title} message={errorCopy.message} />
        ) : null}

        <div className="workspace-delete-dialog__actions">
          <button ref={cancelButtonRef} type="button" className="button button--ghost" onClick={onCancel} disabled={isBusy}>
            Cancel
          </button>
          <Button type="button" tone="secondary" onClick={handleConfirm} disabled={isBusy}>
            {isBusy ? 'Deleting...' : 'Delete workspace'}
          </Button>
        </div>
      </section>
    </div>
  );
}
