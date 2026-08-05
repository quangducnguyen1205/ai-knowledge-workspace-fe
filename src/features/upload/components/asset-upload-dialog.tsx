import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../shared/i18n';
import { AssetUploadForm } from './asset-upload-form';
import { YouTubeAssetForm } from './youtube-asset-form';

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
  youtubeError,
  youtubeSuccessId,
  isCreatingYouTube,
  onUpload,
  onCreateYouTube,
  onResetCreation,
  onClose,
}: {
  workspaceName: string;
  uploadError: unknown;
  uploadSuccessId?: string;
  isUploading: boolean;
  youtubeError: unknown;
  youtubeSuccessId?: string;
  isCreatingYouTube: boolean;
  onUpload: (input: { file: File; title?: string }) => void;
  onCreateYouTube: (input: { url: string; title?: string }) => void;
  onResetCreation: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('upload');
  const [sourceType, setSourceType] = useState<'UPLOAD' | 'YOUTUBE'>('UPLOAD');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isSubmitting = isUploading || isCreatingYouTube;
  const isSubmittingRef = useRef(isSubmitting);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
    onCloseRef.current = onClose;
  }, [isSubmitting, onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmittingRef.current) {
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
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal upload-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-video-dialog-title"
      >
        <header className="modal__header">
          <div>
            <p className="panel__eyebrow">{workspaceName}</p>
            <h2 id="add-video-dialog-title">{t('dialog.title')}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="modal__close"
            aria-label={t('dialog.close')}
            onClick={onClose}
            disabled={isSubmitting}
          >
            ×
          </button>
        </header>

        <fieldset className="source-selector">
          <legend>{t('dialog.sourceLegend')}</legend>
          <div className="source-selector__options">
            <label className={`source-selector__option ${sourceType === 'UPLOAD' ? 'source-selector__option--selected' : ''}`}>
              <input
                type="radio"
                name="video-source"
                value="UPLOAD"
                checked={sourceType === 'UPLOAD'}
                disabled={isSubmitting}
                onChange={() => {
                  onResetCreation();
                  setSourceType('UPLOAD');
                  requestAnimationFrame(() => {
                    dialogRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.focus();
                  });
                }}
              />
              <span>{t('dialog.sourceUpload')}</span>
            </label>
            <label className={`source-selector__option ${sourceType === 'YOUTUBE' ? 'source-selector__option--selected' : ''}`}>
              <input
                type="radio"
                name="video-source"
                value="YOUTUBE"
                checked={sourceType === 'YOUTUBE'}
                disabled={isSubmitting}
                onChange={() => {
                  onResetCreation();
                  setSourceType('YOUTUBE');
                  requestAnimationFrame(() => {
                    dialogRef.current?.querySelector<HTMLInputElement>('input[type="url"]')?.focus();
                  });
                }}
              />
              <span>{t('dialog.sourceYouTube')}</span>
            </label>
          </div>
        </fieldset>

        {sourceType === 'UPLOAD' ? (
          <AssetUploadForm
            workspaceName={workspaceName}
            uploadError={uploadError}
            uploadSuccessId={uploadSuccessId}
            isUploading={isUploading}
            onUpload={onUpload}
          />
        ) : (
          <YouTubeAssetForm
            workspaceName={workspaceName}
            creationError={youtubeError}
            creationSuccessId={youtubeSuccessId}
            isCreating={isCreatingYouTube}
            onCreate={onCreateYouTube}
          />
        )}
      </div>
    </div>
  );
}
