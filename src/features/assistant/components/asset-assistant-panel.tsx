import type { FormEvent } from 'react';
import type { AssistantAnswerCitation } from '../model/types';
import { Button, EmptyState, ErrorBanner, InfoBanner, LoadingBlock, Section } from '../../../lib/ui';
import { useAssetAssistant } from '../hooks/use-asset-assistant';
import { getGenericAssistantErrorMessage } from '../model/assistant-state';
import { AssistantAnswerPanel } from './assistant-answer-panel';

export function AssetAssistantPanel({
  workspaceId,
  workspaceName,
  assetId,
  assetTitle,
  isAssetSearchable,
  onOpenCitationContext,
}: {
  workspaceId: string;
  workspaceName: string;
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
    <Section
      title="Ask this asset"
      eyebrow={assetTitle}
      actions={<span className="panel-pill">{isAssetSearchable ? 'Transcript sources ready' : 'Waiting for search'}</span>}
    >
      <form className="assistant-form" onSubmit={handleSubmit}>
        <label className="field assistant-form__field" htmlFor="asset-assistant-question">
          <span className="field__label">Question</span>
          <textarea
            id="asset-assistant-question"
            className="field__input field__input--textarea"
            value={assistant.question}
            onChange={(event) => assistant.updateQuestion(event.target.value)}
            placeholder={isAssetSearchable
              ? 'Ask a focused question about this transcript...'
              : 'Index this asset before asking transcript-grounded questions'}
            disabled={assistant.isLoading || !isAssetSearchable}
            aria-describedby={assistant.validationError ? `${questionHintId} ${questionErrorId}` : questionHintId}
            aria-invalid={Boolean(assistant.validationError)}
            rows={4}
            maxLength={500}
          />
          <span id={questionHintId} className="field__hint">
            Answers stay scoped to {workspaceName} and this asset.
          </span>
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

      <InfoBanner
        title="Source check"
        message="Review the cited transcript sources before relying on this answer."
        detail="Answers are generated from transcript context for the active workspace and asset."
      />
      {!isAssetSearchable ? (
        <InfoBanner
          tone="warning"
          title="Assistant unlocks after indexing"
          message="This asset must be searchable before the assistant can answer with transcript citations."
        />
      ) : null}

      <div className="assistant-status" aria-live="polite" aria-atomic="false">
        {assistant.result.status === 'idle' ? (
          <EmptyState
            title="Ask about this transcript"
            description="Submit one focused question to get a concise answer with transcript references for this asset."
          />
        ) : null}
        {assistant.result.status === 'loading' ? <LoadingBlock label="Generating answer from transcript sources..." /> : null}
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
            title="Assistant answers are unavailable"
            message="Answers are not available right now. You can still review the transcript and search results for this asset."
          />
        ) : null}
        {assistant.result.status === 'error' ? (
          <ErrorBanner
            error={assistant.result.error}
            title="Assistant request failed"
            message={getGenericAssistantErrorMessage(assistant.result.error)}
          />
        ) : null}
      </div>
    </Section>
  );
}
