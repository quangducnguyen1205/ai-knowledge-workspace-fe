import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { joinClassNames } from './class-names';

export type ButtonTone = 'primary' | 'secondary' | 'ghost';

/**
 * Canonical action control. Tones are semantic — primary for the main action of a surface,
 * secondary for supporting actions, ghost for low-emphasis actions — never page or feature names.
 * The ref is forwarded so a feature can own a stable, bounded focus target instead of searching
 * the document for a control by its visible text.
 */
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }
>(function Button({ tone = 'primary', className, children, ...props }, ref) {
  return (
    <button
      {...props}
      ref={ref}
      className={joinClassNames('button', `button--${tone}`, className)}
    >
      {children}
    </button>
  );
});
