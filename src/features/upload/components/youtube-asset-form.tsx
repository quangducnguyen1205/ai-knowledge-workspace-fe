import { useEffect, useState, type FormEvent } from 'react';
import { Button, ErrorBanner, InfoBanner } from '../../../lib/ui';
import { getFriendlyYouTubeCreationErrorCopy } from '../../assets/model/error-copy';

function getYouTubeUrlValidationError(url: string): string | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return 'Enter a YouTube video URL.';
  if (!/^https:\/\//i.test(trimmedUrl)) return 'Use an HTTPS YouTube video URL.';
  return null;
}

export function YouTubeAssetForm({
  workspaceName,
  creationError,
  creationSuccessId,
  isCreating,
  onCreate,
}: {
  workspaceName: string;
  creationError: unknown;
  creationSuccessId?: string;
  isCreating: boolean;
  onCreate: (input: { url: string; title?: string }) => void;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const creationErrorCopy = getFriendlyYouTubeCreationErrorCopy(creationError);

  useEffect(() => {
    if (!creationSuccessId) return;
    setUrl('');
    setTitle('');
    setUrlValidationError(null);
  }, [creationSuccessId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;

    const validationError = getYouTubeUrlValidationError(url);
    setUrlValidationError(validationError);
    if (validationError) return;

    onCreate({
      url: url.trim(),
      title: title.trim() || undefined,
    });
  }

  return (
    <form className="upload-form stack" onSubmit={handleSubmit} noValidate>
      <p className="upload-form__intro">
        Add a public YouTube video to this workspace. Spring validates and normalizes the URL.
      </p>
      <div className="field">
        <label className="field__label" htmlFor="youtube-url-input">YouTube URL</label>
        <input
          id="youtube-url-input"
          className="field__input"
          type="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (urlValidationError) setUrlValidationError(null);
          }}
          placeholder="https://www.youtube.com/watch?v=..."
          required
          aria-describedby={urlValidationError ? 'youtube-url-hint youtube-url-error' : 'youtube-url-hint'}
          aria-invalid={Boolean(urlValidationError)}
        />
        <span id="youtube-url-hint" className="field__hint">
          Use an HTTPS link to a public YouTube video.
        </span>
        {urlValidationError ? (
          <span id="youtube-url-error" className="field__hint field__hint--error" role="alert">
            {urlValidationError}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="youtube-title-input">
          Video title <small>(optional)</small>
        </label>
        <input
          id="youtube-title-input"
          className="field__input"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Leave blank to use the default title"
          maxLength={255}
        />
      </div>

      <div className="upload-form__actions">
        <Button type="submit" disabled={isCreating}>
          {isCreating ? 'Adding YouTube video...' : 'Add YouTube video'}
        </Button>
      </div>

      {isCreating ? (
        <InfoBanner
          title="Adding YouTube video"
          message={`Creating the video in ${workspaceName}. Keep this dialog open until it is accepted.`}
        />
      ) : null}
      {creationError ? (
        <ErrorBanner
          error={creationError}
          title={creationErrorCopy?.title}
          message={creationErrorCopy?.message}
          detail={creationErrorCopy?.detail}
        />
      ) : null}
    </form>
  );
}
