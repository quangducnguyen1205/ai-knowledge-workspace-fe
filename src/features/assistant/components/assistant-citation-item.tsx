import type { AssistantAnswerCitation } from '../model/types';
import { Button } from '../../../lib/ui';
import { useTranslation } from '../../../shared/i18n';
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
  const { t } = useTranslation(['viewer', 'common']);
  const transcriptReference = resolveAssistantCitationReference(citation);

  return (
    <article className="assistant-citation">
      <div className="assistant-citation__header">
        <div className="search-result__title">
          <span className="search-result__rank">{t('assistant.citations.itemLabel', { index: index + 1 })}</span>
          <strong>{citation.assetTitle}</strong>
        </div>
      </div>

      <div className="assistant-citation__meta">
        <span>{t('common:momentIndex', { index: citation.segmentIndex ?? '—' })}</span>
      </div>

      <div className="assistant-citation__footer">
        {transcriptReference ? (
          <Button
            type="button"
            tone="secondary"
            className="assistant-citation__button"
            onClick={() => onOpenCitationContext(citation)}
            aria-label={t('assistant.citations.openLabel', { index: index + 1, title: citation.assetTitle })}
          >
            {t('assistant.citations.open')}
          </Button>
        ) : (
          <span className="assistant-citation__note">{t('assistant.citations.unavailable')}</span>
        )}
      </div>
    </article>
  );
}
