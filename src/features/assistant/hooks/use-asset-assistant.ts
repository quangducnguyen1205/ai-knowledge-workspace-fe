import { useCallback, useEffect, useRef, useState } from 'react';
import { answerAssistant } from '../api/assistant-api';
import {
  isAssistantUnavailableError,
  type AssistantResultState,
} from '../model/assistant-state';

type ActiveAssistantRequest = { id: number; controller: AbortController };

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResultState>({ status: 'idle' });
  const activeRequestRef = useRef<ActiveAssistantRequest | null>(null);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
    setQuestion('');
    setValidationError(null);
    setResult({ status: 'idle' });
  }, []);

  useEffect(() => reset(), [assetId, reset, workspaceId]);
  useEffect(() => () => activeRequestRef.current?.controller.abort(), []);

  const updateQuestion = useCallback((value: string) => {
    setQuestion(value);
    if (value.trim()) setValidationError(null);
  }, []);

  const submit = useCallback(async () => {
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
    validationError,
    result,
    isLoading: result.status === 'loading',
    submit,
    reset,
  };
}
