import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, readCssToken } from '../../test/contrast';

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

  it('keeps focus visibility on the two semantic focus tokens', () => {
    // Every focus outline in component CSS reads --focus (light surfaces) or --focus-on-dark
    // (rings landing on ink/deep-teal), so focus stays recognizable everywhere.
    const outlineDeclarations = stylesCss.match(/outline:\s*[^;]+;/g) ?? [];
    const colored = outlineDeclarations.filter((declaration) =>
      /#[0-9a-f]{3,8}|rgba?\(/i.test(declaration));

    expect(colored).toEqual([]);
    expect(stylesCss).toMatch(/outline:\s*3px solid var\(--focus\)/);
    expect(stylesCss).toMatch(/outline:\s*3px solid var\(--focus-on-dark\)/);
    expect(stylesCss).toMatch(/:focus-visible/);
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

describe('WCAG contrast of live token values', () => {
  // Every light surface normal-sized muted text actually sits on.
  const lightSurfaces = {
    'warm background': readCssToken(tokensCss, '--bg-warm'),
    'cool background': readCssToken(tokensCss, '--bg-cool'),
    'strong surface': readCssToken(tokensCss, '--surface-strong'),
    'muted surface': readCssToken(tokensCss, '--surface-muted'),
    'teal surface': readCssToken(tokensCss, '--surface-teal'),
    'primary-soft surface': readCssToken(tokensCss, '--primary-soft'),
    'blue-soft surface': readCssToken(tokensCss, '--blue-soft'),
  };

  it('keeps normal muted text at or above 4.5:1 on every light surface', () => {
    const muted = readCssToken(tokensCss, '--text-muted');

    for (const [name, surface] of Object.entries(lightSurfaces)) {
      expect(contrastRatio(muted, surface), `--text-muted on ${name}`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps muted text visually subordinate to primary text', () => {
    const muted = readCssToken(tokensCss, '--text-muted');
    const primaryText = readCssToken(tokensCss, '--text');

    expect(contrastRatio(primaryText, '#ffffff'))
      .toBeGreaterThan(contrastRatio(muted, '#ffffff') + 3);
  });

  it('keeps the light-surface focus ring at or above 3:1 on every light surface', () => {
    const focus = readCssToken(tokensCss, '--focus');

    for (const [name, surface] of Object.entries(lightSurfaces)) {
      expect(contrastRatio(focus, surface), `--focus on ${name}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the dark-surface focus ring at or above 3:1 on ink and deep-teal surfaces', () => {
    const focusOnDark = readCssToken(tokensCss, '--focus-on-dark');
    const darkSurfaces = {
      ink: readCssToken(tokensCss, '--ink'),
      'primary teal': readCssToken(tokensCss, '--primary'),
      'primary strong': readCssToken(tokensCss, '--primary-strong'),
    };

    for (const [name, surface] of Object.entries(darkSurfaces)) {
      expect(contrastRatio(focusOnDark, surface), `--focus-on-dark on ${name}`)
        .toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the standalone favicon in parity with the brand token', () => {
    // Documented exception to "raw palette only in tokens.css": a standalone SVG asset cannot
    // consume CSS custom properties, so it carries the literal — and must match --primary.
    const favicon = readFileSync(resolve(process.cwd(), 'public/favicon.svg'), 'utf8');
    const primary = readCssToken(tokensCss, '--primary');

    expect(favicon.toLowerCase()).toContain(`fill="${primary.toLowerCase()}"`);
  });

  it('composites translucent colors before measuring them', () => {
    // Sanity for the utility itself: a 34% indigo flattened on white is far below 3:1 — the very
    // weakness the solid focus tokens replaced.
    expect(contrastRatio('rgba(49, 89, 203, 0.34)', '#ffffff')).toBeLessThan(3);
    expect(contrastRatio('#3159cb', '#ffffff')).toBeGreaterThan(5);
  });
});
