import { Button } from '../../lib/ui';
import { useTranslation } from '../../shared/i18n';

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
  const { t } = useTranslation('moments');
  const label = t(isSaved ? 'save.savedLabel' : 'save.label', {
    title: assetTitle,
    time: timestampLabel.toLowerCase(),
  });

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
        {isSaving ? t('save.saving') : isSaved ? t('save.saved') : t('save.action')}
      </Button>
      <span className="save-moment__feedback" role="status" aria-live="polite">
        {hasFailed ? t('save.failed') : null}
      </span>
    </div>
  );
}
