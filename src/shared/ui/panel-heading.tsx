import type { ReactNode } from 'react';
import { joinClassNames } from './class-names';

/**
 * Shared layout for a panel heading row: an optional eyebrow above the caller-owned heading
 * element, with optional trailing metadata on the same row. The heading element itself stays with
 * the caller so features keep ownership of its id, ref, tabIndex and accessible relationships —
 * this primitive only owns the repeated visual arrangement.
 */
export function PanelHeading({
  eyebrow,
  trailing,
  className,
  children,
}: {
  eyebrow?: string;
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={joinClassNames('panel-heading', className)}>
      <div className="panel-heading__title">
        {eyebrow ? <p className="panel__eyebrow">{eyebrow}</p> : null}
        {children}
      </div>
      {trailing}
    </div>
  );
}
