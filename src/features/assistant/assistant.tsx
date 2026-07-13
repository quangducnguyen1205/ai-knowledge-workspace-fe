import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  answerAssistant,
  type AssistantAnswerCitation,
  type AssistantAnswerResponse,
} from './api/assistant-api';
import { ApiClientError, isApiClientError } from '../../shared/api/api-error';
import { Button, EmptyState, ErrorBanner, InfoBanner, LoadingBlock, Section, formatDateTime } from '../../lib/ui';

type AssistantResultState =
  | { status: 'idle' }
  | { status: 'loading'; question: string }
  | { status: 'success'; question: string; response: AssistantAnswerResponse }
  | { status: 'insufficient'; question: string; response: AssistantAnswerResponse }
  | { status: 'unavailable'; error: unknown }
  | { status: 'error'; error: unknown };

type ActiveAssistantRequest = {
  id: number;
  controller: AbortController;
};

export function resolveAssistantCitationReference(citation: AssistantAnswerCitation): string | null {
  if (citation.transcriptRowId) {
    return citation.transcriptRowId;
  }

  return citation.segmentIndex !== null ? `segment-${citation.segmentIndex}` : null;
}

function isAssistantUnavailableError(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.status === 503 || error.code === 'ASSISTANT_PROVIDER_UNAVAILABLE')
  );
}

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
  const [question, setQuestion] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResultState>({ status: 'idle' });
  const activeRequestRef = useRef<ActiveAssistantRequest | null>(null);
  const requestIdRef = useRef(0);
  const isLoading = result.status === 'loading';
  const questionErrorId = 'asset-assistant-question-error';
  const questionHintId = 'asset-assistant-question-hint';

  useEffect(() => {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    setQuestion('');
    setValidationError(null);
    setResult({ status: 'idle' });
  }, [workspaceId, assetId]);

  useEffect(() => {
    return () => activeRequestRef.current?.controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    setValidationError(null);

    if (!trimmedQuestion) {
      setValidationError('Ask a question about this asset transcript first.');
      return;
    }

    if (!isAssetSearchable) {
      setValidationError('Index this asset before asking for a grounded answer.');
      return;
    }

    activeRequestRef.current?.controller.abort();

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    activeRequestRef.current = { id: requestId, controller };
    setResult({ status: 'loading', question: trimmedQuestion });

    try {
      const response = await answerAssistant(
        {
          workspaceId,
          assetId,
          question: trimmedQuestion,
        },
        controller.signal,
      );

      if (activeRequestRef.current?.id !== requestId || controller.signal.aborted) {
        return;
      }

      setResult({
        status: response.insufficientContext ? 'insufficient' : 'success',
        question: trimmedQuestion,
        response,
      });
    } catch (error) {
      if (activeRequestRef.current?.id !== requestId || controller.signal.aborted) {
        return;
      }

      setResult({ status: isAssistantUnavailableError(error) ? 'unavailable' : 'error', error });
    } finally {
      if (activeRequestRef.current?.id === requestId) {
        activeRequestRef.current = null;
      }
    }
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
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              if (validationError && event.target.value.trim()) {
                setValidationError(null);
              }
            }}
            placeholder={
              isAssetSearchable
                ? 'Ask a focused question about this transcript...'
                : 'Index this asset before asking transcript-grounded questions'
            }
            disabled={isLoading || !isAssetSearchable}
            aria-describedby={validationError ? `${questionHintId} ${questionErrorId}` : questionHintId}
            aria-invalid={Boolean(validationError)}
            rows={4}
            maxLength={500}
          />
          <span id={questionHintId} className="field__hint">
            Answers stay scoped to {workspaceName} and this asset.
          </span>
          {validationError ? (
            <span id={questionErrorId} className="field__hint field__hint--error" role="alert">
              {validationError}
            </span>
          ) : null}
        </label>

        <div className="assistant-form__actions">
          <Button type="submit" disabled={isLoading || !isAssetSearchable}>
            {isLoading ? 'Asking...' : 'Ask'}
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
        {result.status === 'idle' ? (
          <EmptyState
            title="Ask about this transcript"
            description="Submit one focused question to get a concise answer with transcript references for this asset."
          />
        ) : null}

        {result.status === 'loading' ? <LoadingBlock label="Generating answer from transcript sources..." /> : null}

        {result.status === 'success' ? (
          <AssistantAnswerResult
            question={result.question}
            response={result.response}
            onOpenCitationContext={onOpenCitationContext}
          />
        ) : null}

        {result.status === 'insufficient' ? (
          <AssistantInsufficientContextResult question={result.question} response={result.response} />
        ) : null}

        {result.status === 'unavailable' ? (
          <ErrorBanner
            error={result.error}
            title="Assistant answers are unavailable"
            message="Answers are not available right now. You can still review the transcript and search results for this asset."
          />
        ) : null}

        {result.status === 'error' ? (
          <ErrorBanner
            error={result.error}
            title="Assistant request failed"
            message={getGenericAssistantErrorMessage(result.error)}
          />
        ) : null}
      </div>
    </Section>
  );
}

function getGenericAssistantErrorMessage(error: unknown): string {
  if (isApiClientError(error) && error.status === 400) {
    return 'Use a focused, non-empty question about this asset transcript.';
  }

  return 'The request could not be completed. Refine the question or inspect transcript and search results directly.';
}

function AssistantAnswerResult({
  question,
  response,
  onOpenCitationContext,
}: {
  question: string;
  response: AssistantAnswerResponse;
  onOpenCitationContext: (citation: AssistantAnswerCitation) => void;
}) {
  return (
    <div className="assistant-result">
      <div className="assistant-answer">
        <p className="context-window__label">Question</p>
        <p>{question}</p>
        <p className="context-window__label">Generated answer</p>
        <p className="assistant-answer__body">{response.answer}</p>
      </div>

      <CitationList citations={response.citations} onOpenCitationContext={onOpenCitationContext} />
    </div>
  );
}

function AssistantInsufficientContextResult({
  question,
  response,
}: {
  question: string;
  response: AssistantAnswerResponse;
}) {
  return (
    <div className="assistant-result">
      <div className="assistant-answer assistant-answer--insufficient">
        <p className="context-window__label">Question</p>
        <p>{question}</p>
        <p className="context-window__label">Insufficient context</p>
        <p className="assistant-answer__body">{response.answer}</p>
        <p>Refine the question or inspect transcript and search results before relying on this answer.</p>
      </div>
    </div>
  );
}

function CitationList({
  citations,
  onOpenCitationContext,
}: {
  citations: AssistantAnswerCitation[];
  onOpenCitationContext: (citation: AssistantAnswerCitation) => void;
}) {
  if (!citations.length) {
    return (
      <InfoBanner
        tone="warning"
        title="No citations returned"
        message="No transcript references were returned with this answer. Review the transcript directly before relying on it."
      />
    );
  }

  return (
    <div className="assistant-citations-block">
      <div className="panel-block__header">
        <h3>Cited transcript references</h3>
        <span className="context-panel__hint">{citations.length} {citations.length === 1 ? 'source' : 'sources'}</span>
      </div>

      <ol className="assistant-citations">
        {citations.map((citation, index) => {
          const transcriptReference = resolveAssistantCitationReference(citation);

          return (
            <li key={`${citation.sourceId}-${citation.assetId}-${citation.segmentIndex ?? index}`}>
              <article className="assistant-citation">
                <div className="assistant-citation__header">
                  <div className="search-result__title">
                    <span className="search-result__rank">Source {index + 1}</span>
                    <strong>{citation.assetTitle}</strong>
                  </div>
                  <span className="hit-pill">Citation</span>
                </div>

                <div className="assistant-citation__meta">
                  <span>Segment {citation.segmentIndex ?? 'n/a'}</span>
                  <span>Transcript ref: {transcriptReference ?? 'n/a'}</span>
                  <span>{formatDateTime(citation.createdAt)}</span>
                </div>

                <div className="assistant-citation__footer">
                  <code>{citation.sourceId}</code>
                  {transcriptReference ? (
                    <Button
                      type="button"
                      tone="secondary"
                      className="assistant-citation__button"
                      onClick={() => onOpenCitationContext(citation)}
                      aria-label={`Open transcript context for citation ${index + 1} in ${citation.assetTitle}`}
                    >
                      Open transcript context
                    </Button>
                  ) : (
                    <span className="assistant-citation__note">Transcript context unavailable</span>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
