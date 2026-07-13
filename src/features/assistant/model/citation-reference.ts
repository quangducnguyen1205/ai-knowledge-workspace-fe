import type { AssistantAnswerCitation } from './types';

export function resolveAssistantCitationReference(citation: AssistantAnswerCitation): string | null {
  if (citation.transcriptRowId) return citation.transcriptRowId;
  return citation.segmentIndex !== null ? `segment-${citation.segmentIndex}` : null;
}
