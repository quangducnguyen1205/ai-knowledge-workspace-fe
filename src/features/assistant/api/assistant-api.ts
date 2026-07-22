import { request } from '../../../shared/api/http-client';
import type {
  AssistantAnswerInput,
  AssistantAnswerResponse,
  AssistantAnswerResponsePayload,
} from '../model/types';

export async function answerAssistant(
  input: AssistantAnswerInput,
  signal?: AbortSignal,
): Promise<AssistantAnswerResponse> {
  const response = await request<AssistantAnswerResponsePayload>('/api/assistant/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      assetId: input.assetId,
      question: input.question,
    }),
    signal,
  });
  return {
    ...response,
    citations: response.citations.map((citation) => ({
      ...citation,
      startMs: citation.startMs ?? null,
      endMs: citation.endMs ?? null,
    })),
  };
}
