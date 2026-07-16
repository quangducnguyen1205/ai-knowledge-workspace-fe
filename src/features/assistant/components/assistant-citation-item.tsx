import type { AssistantAnswerCitation } from '../model/types';
import { Button } from '../../../lib/ui';
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
          <span className="search-result__rank">Citation {index + 1}</span>
          <strong>{citation.assetTitle}</strong>
        </div>
      </div>

      <div className="assistant-citation__meta">
        <span>Moment {citation.segmentIndex ?? '—'}</span>
      </div>

      <div className="assistant-citation__footer">
        {transcriptReference ? (
          <Button
            type="button"
            tone="secondary"
            className="assistant-citation__button"
            onClick={() => onOpenCitationContext(citation)}
            aria-label={`Open citation ${index + 1} in transcript for ${citation.assetTitle}`}
          >
            Open in transcript
          </Button>
        ) : (
          <span className="assistant-citation__note">Transcript moment unavailable</span>
        )}
      </div>
    </article>
  );
}
