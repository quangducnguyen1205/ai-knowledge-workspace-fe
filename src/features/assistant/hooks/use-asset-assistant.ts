import { useCallback, useEffect, useRef, useState } from 'react';
import { answerAssistant } from '../api/assistant-api';
import {
  isAssistantUnavailableError,
  type AssistantResultState,
} from '../model/assistant-state';

type ActiveAssistantRequest = { id: number; controller: AbortController };

/** The two validation messages this hook can raise, as `viewer` namespace keys. */
type AssistantValidationKey =
  | 'viewer:assistant.validationEmpty'
  | 'viewer:assistant.validationNotReady';

export function useAssetAssistant({
  workspaceId,
  assetId,
  isAssetSearchable,
}: {
  workspaceId: string;
  assetId: string;
  isAssetSearchable: boolean;
}) {
  const [question, setQuestion] = useState('');
  // Stored as a key, so the message re-renders in whichever language is active when it is shown.
  const [validationErrorKey, setValidationErrorKey] = useState<AssistantValidationKey | null>(null);
  const [result, setResult] = useState<AssistantResultState>({ status: 'idle' });
  const activeRequestRef = useRef<ActiveAssistantRequest | null>(null);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    setQuestion('');
    setValidationErrorKey(null);
    setResult({ status: 'idle' });
  }, []);

  useEffect(() => reset(), [assetId, reset, workspaceId]);
  useEffect(() => () => activeRequestRef.current?.controller.abort(), []);

  const updateQuestion = useCallback((value: string) => {
    setQuestion(value);
    if (value.trim()) setValidationErrorKey(null);
  }, []);

  const submit = useCallback(async () => {
    const trimmedQuestion = question.trim();
    setValidationErrorKey(null);

    if (!trimmedQuestion) {
      setValidationErrorKey('viewer:assistant.validationEmpty');
      return;
    }
    if (!isAssetSearchable) {
      setValidationErrorKey('viewer:assistant.validationNotReady');
      return;
    }

    activeRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    activeRequestRef.current = { id: requestId, controller };
    setResult({ status: 'loading', question: trimmedQuestion });

    try {
      const response = await answerAssistant({ workspaceId, assetId, question: trimmedQuestion }, controller.signal);
      if (activeRequestRef.current?.id !== requestId || controller.signal.aborted) return;
      setResult({
        status: response.insufficientContext ? 'insufficient' : 'success',
        question: trimmedQuestion,
        response,
      });
    } catch (error) {
      if (activeRequestRef.current?.id !== requestId || controller.signal.aborted) return;
      setResult({ status: isAssistantUnavailableError(error) ? 'unavailable' : 'error', error });
    } finally {
      if (activeRequestRef.current?.id === requestId) activeRequestRef.current = null;
    }
  }, [assetId, isAssetSearchable, question, workspaceId]);

  return {
    question,
    updateQuestion,
    validationErrorKey,
    result,
    isLoading: result.status === 'loading',
    submit,
    reset,
  };
}
