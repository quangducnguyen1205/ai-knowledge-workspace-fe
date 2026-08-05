import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, ErrorFeedback, InfoBanner } from '../../../lib/ui';
import { useTranslation } from '../../../shared/i18n';
import { getFriendlyUploadErrorCopy } from '../../assets/public';
import {
  getUploadMediaValidationErrorKey,
  SUPPORTED_UPLOAD_MEDIA_ACCEPT,
} from '../model/supported-upload-media';

export function AssetUploadForm({
  workspaceName,
  uploadError,
  uploadSuccessId,
  isUploading,
  onUpload,
}: {
  workspaceName: string;
  uploadError: unknown;
  uploadSuccessId?: string;
  isUploading: boolean;
  onUpload: (input: { file: File; title?: string }) => void;
}) {
  const { t } = useTranslation(['upload']);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileValidationErrorKey, setFileValidationErrorKey] =
    useState<ReturnType<typeof getUploadMediaValidationErrorKey> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadErrorCopy = getFriendlyUploadErrorCopy(uploadError);

  useEffect(() => {
    if (!uploadSuccessId) return;
    setTitle('');
    setFile(null);
    setFileValidationErrorKey(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadSuccessId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || fileValidationErrorKey || isUploading) return;
    onUpload({ file, title: title.trim() || undefined });
  }

  function handleFileSelection(file: File | null) {
    setFile(file);
    setFileValidationErrorKey(file ? getUploadMediaValidationErrorKey(file) : null);
  }

  return (
    <form className="upload-form stack" onSubmit={handleSubmit}>
      <p className="upload-form__intro">{t('file.intro')}</p>
        <label className="field">
          <span className="field__label">{t('file.titleLabel')} <small>{t('file.optional')}</small></span>
          <input
            className="field__input"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('file.titlePlaceholder')}
            maxLength={255}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('file.fileLabel')}</span>
          <input
            ref={fileInputRef}
            className="field__input field__input--file"
            type="file"
            onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
            accept={SUPPORTED_UPLOAD_MEDIA_ACCEPT}
            aria-describedby={fileValidationErrorKey ? 'upload-file-error' : 'upload-file-hint'}
            aria-invalid={Boolean(fileValidationErrorKey)}
          />
          <span id="upload-file-hint" className="field__hint">{t('file.hint')}</span>
          {fileValidationErrorKey ? (
            <span id="upload-file-error" className="field__hint field__hint--error" role="alert">
              {t(fileValidationErrorKey)}
            </span>
          ) : null}
        </label>

        <div className="upload-form__actions">
          <Button type="submit" disabled={isUploading || !file || Boolean(fileValidationErrorKey)}>
            {isUploading ? t('file.submitting') : t('file.submit')}
          </Button>
        </div>

        {file ? <div className="selected-file"><strong>{t('file.selected')}</strong><span>{file.name}</span></div> : null}
        {isUploading ? (
          <InfoBanner
            title={t('file.progressTitle')}
            message={t('file.progressMessage', { workspace: workspaceName })}
          />
        ) : null}
        {uploadError ? (
          <ErrorFeedback
            error={uploadError}
            title={uploadErrorCopy ? t(uploadErrorCopy.titleKey) : undefined}
            message={uploadErrorCopy ? t(uploadErrorCopy.messageKey) : undefined}
          />
        ) : null}
    </form>
  );
}
