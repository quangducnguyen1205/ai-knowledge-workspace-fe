import { request } from '../../../shared/api/http-client';

export type AssistantAnswerCitation = {
  sourceId: string;
  assetId: string;
  assetTitle: string;
  transcriptRowId: string | null;
  segmentIndex: number | null;
  createdAt: string | null;
};

export type AssistantAnswerResponse = {
  answer: string;
  citations: AssistantAnswerCitation[];
  insufficientContext: boolean;
};

export type AssistantAnswerInput = {
  workspaceId: string;
  assetId: string;
  question: string;
};

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
