import type { AssistantAnswerCitation } from '../model/types';
import { Button, formatDateTime } from '../../../lib/ui';
import { resolveAssistantCitationReference } from '../model/citation-reference';

export function AssistantCitationItem({
  citation,
  index,
  onOpenCitationContext,
}: {
  citation: AssistantAnswerCitation;
  index: number;
  onOpenCitationContext: (citation: AssistantAnswerCitation) => void;
}) {
  const transcriptReference = resolveAssistantCitationReference(citation);

  return (
    <article className="assistant-citation">
      <div className="assistant-citation__header">
        <div className="search-result__title">
          <span className="search-result__rank">Source {index + 1}</span>
          <strong>{citation.assetTitle}</strong>
        </div>
        <span className="hit-pill">Citation</span>
      </div>

      <div className="assistant-citation__meta">
        <span>Segment {citation.segmentIndex ?? 'n/a'}</span>
        <span>Transcript ref: {transcriptReference ?? 'n/a'}</span>
        <span>{formatDateTime(citation.createdAt)}</span>
      </div>

      <div className="assistant-citation__footer">
        <code>{citation.sourceId}</code>
        {transcriptReference ? (
          <Button
            type="button"
            tone="secondary"
            className="assistant-citation__button"
            onClick={() => onOpenCitationContext(citation)}
            aria-label={`Open transcript context for citation ${index + 1} in ${citation.assetTitle}`}
          >
            Open transcript context
          </Button>
        ) : (
          <span className="assistant-citation__note">Transcript context unavailable</span>
        )}
      </div>
    </article>
  );
}
