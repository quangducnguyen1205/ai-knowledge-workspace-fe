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
