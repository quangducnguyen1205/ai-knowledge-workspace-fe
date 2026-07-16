import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, ErrorBanner, InfoBanner } from '../../../lib/ui';
import { getFriendlyUploadErrorCopy } from '../../assets/model/error-copy';
import {
  getUploadMediaValidationError,
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
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadErrorCopy = getFriendlyUploadErrorCopy(uploadError);

  useEffect(() => {
    if (!uploadSuccessId) return;
    setTitle('');
    setFile(null);
    setFileValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadSuccessId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || fileValidationError || isUploading) return;
    onUpload({ file, title: title.trim() || undefined });
  }

  function handleFileSelection(file: File | null) {
    setFile(file);
    setFileValidationError(file ? getUploadMediaValidationError(file) : null);
  }

  return (
    <form className="upload-form stack" onSubmit={handleSubmit}>
      <p className="upload-form__intro">Choose a video to add to this workspace. You can leave the title blank to use its filename.</p>
        <label className="field">
          <span className="field__label">Video title <small>(optional)</small></span>
          <input
            className="field__input"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Leave blank to use the filename"
            maxLength={255}
          />
        </label>

        <label className="field">
          <span className="field__label">Video file</span>
          <input
            ref={fileInputRef}
            className="field__input field__input--file"
            type="file"
            onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
            accept={SUPPORTED_UPLOAD_MEDIA_ACCEPT}
            aria-describedby={fileValidationError ? 'upload-file-error' : 'upload-file-hint'}
            aria-invalid={Boolean(fileValidationError)}
          />
          <span id="upload-file-hint" className="field__hint">
            MP4, MOV, M4V, WebM, or AVI.
          </span>
          {fileValidationError ? (
            <span id="upload-file-error" className="field__hint field__hint--error" role="alert">
              {fileValidationError}
            </span>
          ) : null}
        </label>

        <div className="upload-form__actions">
          <Button type="submit" disabled={isUploading || !file || Boolean(fileValidationError)}>
            {isUploading ? 'Uploading video...' : 'Upload video'}
          </Button>
        </div>

        {file ? <div className="selected-file"><strong>Selected</strong><span>{file.name}</span></div> : null}
        {isUploading ? (
          <InfoBanner
            title="Uploading video"
            message={`Adding the selected file to ${workspaceName}. Keep this dialog open until the upload finishes.`}
          />
        ) : null}
        {uploadError ? (
          <ErrorBanner
            error={uploadError}
            title={uploadErrorCopy?.title}
            message={uploadErrorCopy?.message}
            detail={uploadErrorCopy?.detail}
          />
        ) : null}
    </form>
  );
}
