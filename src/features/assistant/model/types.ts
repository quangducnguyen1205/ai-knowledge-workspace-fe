export type AssistantAnswerCitation = {
  sourceId: string;
  assetId: string;
  assetTitle: string;
  transcriptRowId: string | null;
  segmentIndex: number | null;
  startMs: number | null;
  endMs: number | null;
  createdAt: string | null;
};

export type AssistantAnswerCitationPayload = Omit<AssistantAnswerCitation, 'startMs' | 'endMs'> & {
  startMs?: number | null;
  endMs?: number | null;
};

export type AssistantAnswerResponse = {
  answer: string;
  citations: AssistantAnswerCitation[];
  insufficientContext: boolean;
};

export type AssistantAnswerResponsePayload = Omit<AssistantAnswerResponse, 'citations'> & {
  citations: AssistantAnswerCitationPayload[];
};

export type AssistantAnswerInput = {
  workspaceId: string;
  assetId: string;
  question: string;
};
