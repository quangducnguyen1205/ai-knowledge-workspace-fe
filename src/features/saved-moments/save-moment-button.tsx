import { Button } from '../../lib/ui';

export type SaveMomentButtonProps = {
  assetTitle: string;
  timestampLabel: string;
  isSaved: boolean;
  isSaving: boolean;
  hasFailed: boolean;
  disabled?: boolean;
  onSave: () => void;
};

/**
 * Standalone control for the currently selected moment. It is deliberately rendered outside the
 * search-result button so no interactive element is ever nested inside another.
 */
export function SaveMomentButton({
  assetTitle,
  timestampLabel,
  isSaved,
  isSaving,
  hasFailed,
  disabled = false,
  onSave,
}: SaveMomentButtonProps) {
  const label = isSaved
    ? `Moment in ${assetTitle} at ${timestampLabel.toLowerCase()} is saved`
    : `Save moment in ${assetTitle} at ${timestampLabel.toLowerCase()}`;

  return (
    <div className="save-moment">
      <Button
        type="button"
        tone={isSaved ? 'secondary' : 'primary'}
        className="save-moment__action"
        onClick={onSave}
        disabled={disabled || isSaving || isSaved}
        aria-label={label}
        aria-pressed={isSaved}
      >
        {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save moment'}
      </Button>
      <span className="save-moment__feedback" role="status" aria-live="polite">
        {hasFailed ? 'Could not save this moment. Try again.' : null}
      </span>
    </div>
  );
}
