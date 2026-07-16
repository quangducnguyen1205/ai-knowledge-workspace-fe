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
      title: 'Không thể xóa workspace',
      message: 'Workspace chưa bị xóa. Vui lòng thử lại sau.',
    } : null;
  }

  if (error.status === 409 && error.code === 'DEFAULT_WORKSPACE_DELETE_FORBIDDEN') {
    return {
      tone: 'warning',
      title: 'Không thể xóa workspace mặc định',
      message: 'Workspace mặc định được bảo vệ và không thể xóa.',
    };
  }

  if (error.status === 409 && error.code === 'WORKSPACE_NOT_EMPTY') {
    return {
      tone: 'warning',
      title: 'Workspace vẫn còn tài liệu',
      message: 'Hãy xóa các tài liệu trong workspace trước rồi thử lại.',
    };
  }

  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Không tìm thấy workspace',
      message: 'Workspace không còn tồn tại hoặc bạn không có quyền truy cập.',
    };
  }

  if (error.status === 0) {
    return {
      tone: 'error',
      title: 'Chưa thể xóa workspace',
      message: 'Kiểm tra kết nối mạng rồi thử lại. Workspace chưa bị xóa.',
    };
  }

  return {
    tone: 'error',
    title: 'Không thể xóa workspace',
    message: 'Workspace chưa bị xóa. Vui lòng thử lại sau.',
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
