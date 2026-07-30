import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync(resolve(process.cwd(), 'src/shared/theme/tokens.css'), 'utf8');
const stylesCss = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('theme token ownership', () => {
  it('defines every required semantic token in the token owner', () => {
    const requiredTokens = [
      // color
      '--primary', '--primary-strong', '--primary-soft', '--primary-border', '--primary-ring',
      '--blue', '--blue-soft', '--focus',
      '--text', '--text-secondary', '--text-muted', '--text-inverse',
      '--surface', '--surface-strong', '--surface-muted', '--border', '--border-strong',
      '--success', '--warning', '--danger', '--scrim', '--ink',
      '--playback', '--playback-soft',
      // typography
      '--font-body', '--font-display',
      // geometry
      '--space-1', '--space-4', '--space-7',
      '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-control',
      '--content-width', '--shadow-sm', '--shadow-md', '--shadow-lg',
      '--layer-header', '--layer-popover', '--layer-modal', '--layer-skip-link',
      // motion
      '--motion-fast', '--motion-base', '--ease-standard',
    ];

    for (const token of requiredTokens) {
      expect(tokensCss, token).toContain(`${token}:`);
    }
  });

  it('keeps brand palette values out of component CSS', () => {
    // The deep-teal brand family and the playback blues may appear only in tokens.css. This is
    // deliberately scoped: generic one-off white overlays remain legal in component CSS.
    const brandLiterals = /#176f64|#10564f|#dcefeb|23,\s*111,\s*100|#2563eb|#1d4ed8|#eff6ff|#dbeafe|37,\s*99,\s*235/i;

    expect(stylesCss).not.toMatch(brandLiterals);
    expect(tokensCss).toMatch(/#176f64/i);
  });

  it('keeps focus visibility on the single focus token', () => {
    // Every focus outline in component CSS reads the token, so focus stays one recognizable color.
    const outlineDeclarations = stylesCss.match(/outline:\s*[^;]+;/g) ?? [];
    const colored = outlineDeclarations.filter((declaration) =>
      /#[0-9a-f]{3,8}|rgba?\(/i.test(declaration));

    expect(colored).toEqual([]);
    expect(stylesCss).toMatch(/outline:\s*3px solid var\(--focus\)/);
  });

  it('keeps reduced-motion support for non-essential motion', () => {
    expect(stylesCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(stylesCss).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(stylesCss).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it('serves fonts from bundled system stacks without remote dependencies', () => {
    expect(tokensCss).not.toMatch(/@import\s+url|fonts\.googleapis|@font-face/);
    expect(stylesCss).not.toMatch(/@import\s+url|fonts\.googleapis|@font-face/);
  });
});
