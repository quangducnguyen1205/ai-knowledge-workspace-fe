import { joinClassNames } from './class-names';

/** Labelled inline loading indicator; the label carries the meaning, never the dot alone. */
export function LoadingBlock({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={joinClassNames('loading-block', compact && 'loading-block--compact')}>
      <span className="loading-block__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
