import type { AssistantAnswerCitation } from '../model/types';
import { InfoBanner } from '../../../lib/ui';
import { useTranslation } from '../../../shared/i18n';
import { AssistantCitationItem } from './assistant-citation-item';

export function AssistantCitationList({
  citations,
  onOpenCitationContext,
}: {
  citations: AssistantAnswerCitation[];
  onOpenCitationContext: (citation: AssistantAnswerCitation) => void;
}) {
  const { t } = useTranslation('viewer');

  if (!citations.length) {
    return (
      <InfoBanner
        tone="warning"
        title={t('assistant.citations.noneTitle')}
        message={t('assistant.citations.noneMessage')}
      />
    );
  }

  return (
    <div className="assistant-citations-block">
      <div className="panel-block__header">
        <h3>{t('assistant.citations.heading')}</h3>
        <span className="context-panel__hint">{t('assistant.citations.count', { count: citations.length })}</span>
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
