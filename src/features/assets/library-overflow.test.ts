import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

/**
 * Regression: at 390px the Library page overflowed horizontally by 72px because
 * `.library-filters` had no `min-width: 0` — the mobile chip scroller could not shrink inside
 * the stacked column and forced the panel wider than the viewport.
 */
describe('library filter row stays contained on narrow viewports', () => {
  it('lets the filter row shrink below its content width', () => {
    expect(styles).toMatch(/\.library-filters\s*\{[^}]*min-width:\s*0/);
  });

  it('keeps the mobile chip strip a contained horizontal scroller', () => {
    const under760 = styles.slice(styles.indexOf('@media (max-width: 760px)'));
    expect(under760).toMatch(/\.library-filters\s*\{[^}]*flex-direction:\s*column/);
    expect(under760).toMatch(/\.filter-chips\s*\{[^}]*overflow-x:\s*auto/);
  });
});
