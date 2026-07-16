import type { FormEvent } from 'react';
import type { AssistantAnswerCitation } from '../model/types';
import { Button, ErrorBanner, LoadingBlock, Section } from '../../../lib/ui';
import { useAssetAssistant } from '../hooks/use-asset-assistant';
import { getGenericAssistantErrorMessage } from '../model/assistant-state';
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
  const assistant = useAssetAssistant({ workspaceId, assetId, isAssetSearchable });
  const questionErrorId = 'asset-assistant-question-error';
  const questionHintId = 'asset-assistant-question-hint';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void assistant.submit();
  }

  return (
    <Section title="Ask this video" className="assistant-panel">
      <form className="assistant-form" onSubmit={handleSubmit}>
        <label className="field assistant-form__field" htmlFor="asset-assistant-question">
          <span className="field__label">Question</span>
          <textarea
            id="asset-assistant-question"
            className="field__input field__input--textarea"
            value={assistant.question}
            onChange={(event) => assistant.updateQuestion(event.target.value)}
            placeholder={isAssetSearchable ? 'Ask a question about this video' : 'Available when this video is ready'}
            disabled={assistant.isLoading || !isAssetSearchable}
            aria-describedby={assistant.validationError ? `${questionHintId} ${questionErrorId}` : questionHintId}
            aria-invalid={Boolean(assistant.validationError)}
            rows={3}
            maxLength={500}
          />
          <span id={questionHintId} className="field__hint">Answers include links to supporting transcript moments.</span>
          {assistant.validationError ? (
            <span id={questionErrorId} className="field__hint field__hint--error" role="alert">
              {assistant.validationError}
            </span>
          ) : null}
        </label>
        <div className="assistant-form__actions">
          <Button type="submit" disabled={assistant.isLoading || !isAssetSearchable}>
            {assistant.isLoading ? 'Asking...' : 'Ask'}
          </Button>
        </div>
      </form>

      {!isAssetSearchable ? <p className="assistant-availability" role="status">Ask will be available when this video is ready.</p> : null}

      <div className="assistant-status" aria-live="polite" aria-atomic="false">
        {assistant.result.status === 'idle' && isAssetSearchable ? (
          <p className="assistant-idle">Ask about a concept, argument, or detail from this video.</p>
        ) : null}
        {assistant.result.status === 'loading' ? <LoadingBlock label="Finding an answer..." compact /> : null}
        {assistant.result.status === 'success' || assistant.result.status === 'insufficient' ? (
          <AssistantAnswerPanel
            question={assistant.result.question}
            response={assistant.result.response}
            onOpenCitationContext={onOpenCitationContext}
          />
        ) : null}
        {assistant.result.status === 'unavailable' ? (
          <ErrorBanner
            error={assistant.result.error}
            title="Answers are temporarily unavailable"
            message="You can still read and search this transcript. Try asking again later."
          />
        ) : null}
        {assistant.result.status === 'error' ? (
          <ErrorBanner error={assistant.result.error} title="Could not answer this question" message={getGenericAssistantErrorMessage(assistant.result.error)} />
        ) : null}
      </div>
    </Section>
  );
}
