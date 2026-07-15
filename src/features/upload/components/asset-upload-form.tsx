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
    <div className="upload-card">
      <div className="upload-card__copy">
        <p className="panel__eyebrow">Add source material</p>
        <h3>Upload a lecture video</h3>
        <p>Every uploaded asset moves through transcript preparation, automatic indexing, and focused workspace search.</p>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Asset title</span>
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
          <span className="field__label">Source file</span>
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
            Use an MP4, MOV, M4V, WebM, or AVI lecture video. MP4 works well for local smoke checks.
          </span>
          {fileValidationError ? (
            <span id="upload-file-error" className="field__hint field__hint--error" role="alert">
              {fileValidationError}
            </span>
          ) : null}
        </label>

        <div className="upload-card__actions">
          <Button type="submit" disabled={isUploading || !file || Boolean(fileValidationError)}>
            {isUploading ? `Uploading to ${workspaceName}...` : 'Upload to workspace'}
          </Button>
          <span className="upload-card__hint">Uploaded assets appear in the library first, then move through processing.</span>
        </div>

        {file ? <div className="selected-file"><strong>Selected file</strong><span>{file.name}</span></div> : null}
        {isUploading ? (
          <InfoBanner
            title="Upload in progress"
            message={`Adding the selected file to ${workspaceName}. It will appear in the library and continue processing in place.`}
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
    </div>
  );
}
