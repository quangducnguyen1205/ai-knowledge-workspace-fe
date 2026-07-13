import { request } from '../../../shared/api/http-client';
import type { AssistantAnswerInput, AssistantAnswerResponse } from '../model/types';

export async function answerAssistant(
  input: AssistantAnswerInput,
  signal?: AbortSignal,
): Promise<AssistantAnswerResponse> {
  return request<AssistantAnswerResponse>('/api/assistant/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      assetId: input.assetId,
      question: input.question,
    }),
    signal,
  });
}
