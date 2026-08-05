import type { AssistantAnswerResponse } from './types';
import { ApiClientError, isApiClientError } from '../../../shared/api/api-error';

export type AssistantResultState =
  | { status: 'idle' }
  | { status: 'loading'; question: string }
  | { status: 'success'; question: string; response: AssistantAnswerResponse }
  | { status: 'insufficient'; question: string; response: AssistantAnswerResponse }
  | { status: 'unavailable'; error: unknown }
  | { status: 'error'; error: unknown };

export function isAssistantUnavailableError(error: unknown): boolean {
  return error instanceof ApiClientError && (
    error.status === 503 ||
    error.code === 'ASSISTANT_SERVICE_UNAVAILABLE' ||
    error.code === 'ASSISTANT_PROVIDER_UNAVAILABLE'
  );
}

/** `viewer` namespace key for the guidance shown beside a failed answer. */
export function getGenericAssistantErrorMessageKey(error: unknown) {
  return isApiClientError(error) && error.status === 400
    ? ('viewer:assistant.errorInvalidQuestion' as const)
    : ('viewer:assistant.errorGeneric' as const);
}
