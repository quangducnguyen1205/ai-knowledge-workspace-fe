import type { HTMLAttributes, ReactNode } from 'react';
import { joinClassNames } from './class-names';

/** Card-like page section with an owned h2 title, optional eyebrow and trailing actions. */
export function Section({
  title,
  eyebrow,
  actions,
  children,
  className,
}: HTMLAttributes<HTMLElement> & {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={joinClassNames('panel', className)}>
      <div className="panel__header">
        <div>
          {eyebrow ? <p className="panel__eyebrow">{eyebrow}</p> : null}
          <h2 className="panel__title">{title}</h2>
        </div>
        {actions ? <div className="panel__actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
