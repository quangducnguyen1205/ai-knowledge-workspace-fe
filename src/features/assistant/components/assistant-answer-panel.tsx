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
          <p className="context-window__label">Answer to “{question}”</p>
          <p className="assistant-answer__body">{response.answer}</p>
          <p>Try a more specific question or search the transcript directly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant-result">
      <div className="assistant-answer">
        <p className="context-window__label">Answer to “{question}”</p>
        <p className="assistant-answer__body">{response.answer}</p>
      </div>
      <AssistantCitationList citations={response.citations} onOpenCitationContext={onOpenCitationContext} />
    </div>
  );
}
