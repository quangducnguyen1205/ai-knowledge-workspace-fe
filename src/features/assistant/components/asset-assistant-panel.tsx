import type { FormEvent } from 'react';
import type { AssistantAnswerCitation } from '../model/types';
import { Button, ErrorFeedback, LoadingBlock, Section } from '../../../lib/ui';
import { useTranslation } from '../../../shared/i18n';
import { useAssetAssistant } from '../hooks/use-asset-assistant';
import { getGenericAssistantErrorMessageKey } from '../model/assistant-state';
import { AssistantAnswerPanel } from './assistant-answer-panel';

export function AssetAssistantPanel({
  workspaceId,
  assetId,
  isAssetSearchable,
  onOpenCitationContext,
}: {
  workspaceId: string;
  assetId: string;
  assetTitle: string;
  isAssetSearchable: boolean;
  onOpenCitationContext: (citation: AssistantAnswerCitation) => void;
}) {
  const { t } = useTranslation(['viewer']);
  const assistant = useAssetAssistant({ workspaceId, assetId, isAssetSearchable });
  const questionErrorId = 'asset-assistant-question-error';
  const questionHintId = 'asset-assistant-question-hint';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void assistant.submit();
  }

  return (
    <Section title={t('assistant.title')} className="assistant-panel">
      <form className="assistant-form" onSubmit={handleSubmit}>
        <label className="field assistant-form__field" htmlFor="asset-assistant-question">
          <span className="field__label">{t('assistant.questionLabel')}</span>
          <textarea
            id="asset-assistant-question"
            className="field__input field__input--textarea"
            value={assistant.question}
            onChange={(event) => assistant.updateQuestion(event.target.value)}
            placeholder={isAssetSearchable ? t('assistant.questionPlaceholder') : t('assistant.questionUnavailable')}
            disabled={assistant.isLoading || !isAssetSearchable}
            aria-describedby={assistant.validationErrorKey ? `${questionHintId} ${questionErrorId}` : questionHintId}
            aria-invalid={Boolean(assistant.validationErrorKey)}
            rows={3}
            maxLength={500}
          />
          <span id={questionHintId} className="field__hint">{t('assistant.questionHint')}</span>
          {assistant.validationErrorKey ? (
            <span id={questionErrorId} className="field__hint field__hint--error" role="alert">
              {t(assistant.validationErrorKey)}
            </span>
          ) : null}
        </label>
        <div className="assistant-form__actions">
          <Button type="submit" disabled={assistant.isLoading || !isAssetSearchable}>
            {assistant.isLoading ? t('assistant.submitting') : t('assistant.submit')}
          </Button>
        </div>
      </form>

      {!isAssetSearchable ? <p className="assistant-availability" role="status">{t('assistant.unavailableNote')}</p> : null}

      <div className="assistant-status" aria-live="polite" aria-atomic="false">
        {assistant.result.status === 'idle' && isAssetSearchable ? (
          <p className="assistant-idle">{t('assistant.idle')}</p>
        ) : null}
        {assistant.result.status === 'loading' ? <LoadingBlock label={t('assistant.loading')} compact /> : null}
        {assistant.result.status === 'success' || assistant.result.status === 'insufficient' ? (
          <AssistantAnswerPanel
            question={assistant.result.question}
            response={assistant.result.response}
            onOpenCitationContext={onOpenCitationContext}
          />
        ) : null}
        {assistant.result.status === 'unavailable' ? (
          <ErrorFeedback
            error={assistant.result.error}
            title={t('assistant.unavailableTitle')}
            message={t('assistant.unavailableMessage')}
          />
        ) : null}
        {assistant.result.status === 'error' ? (
          <ErrorFeedback
            error={assistant.result.error}
            title={t('assistant.errorTitle')}
            message={t(getGenericAssistantErrorMessageKey(assistant.result.error))}
          />
        ) : null}
      </div>
    </Section>
  );
}
