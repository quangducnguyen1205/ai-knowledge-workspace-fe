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

export function getGenericAssistantErrorMessage(error: unknown): string {
  if (isApiClientError(error) && error.status === 400) {
    return 'Use a focused, non-empty question about this asset transcript.';
  }

  return 'Không thể hoàn tất câu hỏi. Hãy thử diễn đạt ngắn gọn hơn hoặc xem trực tiếp transcript và kết quả tìm kiếm.';
}
