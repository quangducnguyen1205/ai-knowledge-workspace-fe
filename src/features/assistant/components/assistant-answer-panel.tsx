import type { AssistantAnswerCitation, AssistantAnswerResponse } from '../model/types';
import { useTranslation } from '../../../shared/i18n';
import { AssistantCitationList } from './assistant-citation-list';

export function AssistantAnswerPanel({
  question,
  response,
  onOpenCitationContext,
}: {
  question: string;
  response: AssistantAnswerResponse;
  onOpenCitationContext: (citation: AssistantAnswerCitation) => void;
}) {
  const { t } = useTranslation('viewer');

  if (response.insufficientContext) {
    return (
      <div className="assistant-result">
        <div className="assistant-answer assistant-answer--insufficient">
          <p className="context-window__label">{t('assistant.answerTo', { question })}</p>
          <p className="assistant-answer__body">{response.answer}</p>
          <p>{t('assistant.insufficient')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant-result">
      <div className="assistant-answer">
        <p className="context-window__label">{t('assistant.answerTo', { question })}</p>
        <p className="assistant-answer__body">{response.answer}</p>
      </div>
      <AssistantCitationList citations={response.citations} onOpenCitationContext={onOpenCitationContext} />
    </div>
  );
}
