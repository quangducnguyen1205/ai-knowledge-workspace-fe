import { useEffect, useRef } from 'react';
import { AssetUploadForm } from './asset-upload-form';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
].join(',');

export function AssetUploadDialog({
  workspaceName,
  uploadError,
  uploadSuccessId,
  isUploading,
  onUpload,
  onClose,
}: {
  workspaceName: string;
  uploadError: unknown;
  uploadSuccessId?: string;
  isUploading: boolean;
  onUpload: (input: { file: File; title?: string }) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isUploadingRef = useRef(isUploading);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    isUploadingRef.current = isUploading;
    onCloseRef.current = onClose;
  }, [isUploading, onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isUploadingRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isUploading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal upload-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-dialog-title"
      >
        <header className="modal__header">
          <div>
            <p className="panel__eyebrow">{workspaceName}</p>
            <h2 id="upload-dialog-title">Upload video</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="modal__close"
            aria-label="Close upload dialog"
            onClick={onClose}
            disabled={isUploading}
          >
            ×
          </button>
        </header>
        <AssetUploadForm
          workspaceName={workspaceName}
          uploadError={uploadError}
          uploadSuccessId={uploadSuccessId}
          isUploading={isUploading}
          onUpload={onUpload}
        />
      </div>
    </div>
  );
}
