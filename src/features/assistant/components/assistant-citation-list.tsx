import type { AssistantAnswerCitation } from '../model/types';
import { InfoBanner } from '../../../lib/ui';
import { AssistantCitationItem } from './assistant-citation-item';

export function AssistantCitationList({
  citations,
  onOpenCitationContext,
}: {
  citations: AssistantAnswerCitation[];
  onOpenCitationContext: (citation: AssistantAnswerCitation) => void;
}) {
  if (!citations.length) {
    return (
      <InfoBanner
        tone="warning"
        title="No supporting moments"
        message="Review the transcript directly before relying on this answer."
      />
    );
  }

  return (
    <div className="assistant-citations-block">
      <div className="panel-block__header">
        <h3>Supporting moments</h3>
        <span className="context-panel__hint">{citations.length} {citations.length === 1 ? 'citation' : 'citations'}</span>
      </div>
      <ol className="assistant-citations">
        {citations.map((citation, index) => (
          <li key={`${citation.sourceId}-${citation.assetId}-${citation.segmentIndex ?? index}`}>
            <AssistantCitationItem
              citation={citation}
              index={index}
              onOpenCitationContext={onOpenCitationContext}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
