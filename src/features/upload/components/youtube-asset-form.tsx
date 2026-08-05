import { useEffect, useState, type FormEvent } from 'react';
import { Button, ErrorFeedback, InfoBanner } from '../../../lib/ui';
import { useTranslation } from '../../../shared/i18n';
import { getFriendlyYouTubeCreationErrorCopy } from '../../assets/public';

/** Which validation message applies, as an `upload` namespace key. */
function getYouTubeUrlValidationErrorKey(url: string) {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return 'upload:youtube.urlRequired' as const;
  if (!/^https:\/\//i.test(trimmedUrl)) return 'upload:youtube.urlNotHttps' as const;
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
  const { t } = useTranslation(['upload']);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [urlValidationErrorKey, setUrlValidationErrorKey] =
    useState<ReturnType<typeof getYouTubeUrlValidationErrorKey>>(null);
  const creationErrorCopy = getFriendlyYouTubeCreationErrorCopy(creationError);

  useEffect(() => {
    if (!creationSuccessId) return;
    setUrl('');
    setTitle('');
    setUrlValidationErrorKey(null);
  }, [creationSuccessId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;

    const validationErrorKey = getYouTubeUrlValidationErrorKey(url);
    setUrlValidationErrorKey(validationErrorKey);
    if (validationErrorKey) return;

    onCreate({
      url: url.trim(),
      title: title.trim() || undefined,
    });
  }

  return (
    <form className="upload-form stack" onSubmit={handleSubmit} noValidate>
      <p className="upload-form__intro">{t('youtube.intro')}</p>
      <div className="field">
        <label className="field__label" htmlFor="youtube-url-input">{t('youtube.urlLabel')}</label>
        <input
          id="youtube-url-input"
          className="field__input"
          type="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (urlValidationErrorKey) setUrlValidationErrorKey(null);
          }}
          placeholder={t('youtube.urlPlaceholder')}
          required
          aria-describedby={urlValidationErrorKey ? 'youtube-url-hint youtube-url-error' : 'youtube-url-hint'}
          aria-invalid={Boolean(urlValidationErrorKey)}
        />
        <span id="youtube-url-hint" className="field__hint">{t('youtube.urlHint')}</span>
        {urlValidationErrorKey ? (
          <span id="youtube-url-error" className="field__hint field__hint--error" role="alert">
            {t(urlValidationErrorKey)}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="youtube-title-input">
          {t('youtube.titleLabel')} <small>{t('file.optional')}</small>
        </label>
        <input
          id="youtube-title-input"
          className="field__input"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('youtube.titlePlaceholder')}
          maxLength={255}
        />
      </div>

      <div className="upload-form__actions">
        <Button type="submit" disabled={isCreating}>
          {isCreating ? t('youtube.submitting') : t('youtube.submit')}
        </Button>
      </div>

      {isCreating ? (
        <InfoBanner
          title={t('youtube.progressTitle')}
          message={t('youtube.progressMessage', { workspace: workspaceName })}
        />
      ) : null}
      {creationError ? (
        <ErrorFeedback
          error={creationError}
          title={creationErrorCopy ? t(creationErrorCopy.titleKey) : undefined}
          message={creationErrorCopy ? t(creationErrorCopy.messageKey) : undefined}
        />
      ) : null}
    </form>
  );
}
