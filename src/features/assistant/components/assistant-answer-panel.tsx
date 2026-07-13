import type { AssistantAnswerCitation, AssistantAnswerResponse } from '../model/types';
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
  if (response.insufficientContext) {
    return (
      <div className="assistant-result">
        <div className="assistant-answer assistant-answer--insufficient">
          <p className="context-window__label">Question</p>
          <p>{question}</p>
          <p className="context-window__label">Insufficient context</p>
          <p className="assistant-answer__body">{response.answer}</p>
          <p>Refine the question or inspect transcript and search results before relying on this answer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant-result">
      <div className="assistant-answer">
        <p className="context-window__label">Question</p>
        <p>{question}</p>
        <p className="context-window__label">Generated answer</p>
        <p className="assistant-answer__body">{response.answer}</p>
      </div>
      <AssistantCitationList citations={response.citations} onOpenCitationContext={onOpenCitationContext} />
    </div>
  );
}
