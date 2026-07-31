import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const landingCss = readFileSync(
  resolve(process.cwd(), 'src/features/public-landing/public-landing.css'),
  'utf8',
);

describe('landing responsive rules', () => {
  it('prevents horizontal overflow at the landing root', () => {
    expect(landingCss).toMatch(/\.me-landing\s*\{[^}]*overflow-x:\s*clip/s);
  });

  it('uses only the canonical breakpoints', () => {
    const widths = Array.from(landingCss.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g), (match) => match[1]);

    expect(new Set(widths)).toEqual(new Set(['1080', '900', '760', '430']));
  });

  it('keeps CTA touch targets at 44px or more', () => {
    expect(landingCss).toMatch(/\.me-cta\s*\{[^}]*min-height:\s*44px/s);
    expect(landingCss).toMatch(/\.me-brand\s*\{[^}]*min-height:\s*44px/s);
  });

  it('keeps narrow-viewport chapters in normal document flow instead of a long pin', () => {
    const narrowBlock = landingCss.slice(landingCss.indexOf('@media (max-width: 900px)'));

    expect(narrowBlock).toMatch(/\.me-chapter\s*\{[^}]*min-height:\s*0/s);
  });

  it('stacks the hero actions on the smallest screens', () => {
    const smallest = landingCss.slice(landingCss.indexOf('@media (max-width: 430px)'));

    expect(smallest).toMatch(/\.me-hero__actions\s*\{[^}]*flex-direction:\s*column/s);
  });

  it('turns the reveal transition off under prefers-reduced-motion', () => {
    const reducedMotion = landingCss.slice(landingCss.indexOf('@media (prefers-reduced-motion: reduce)'));

    expect(reducedMotion).toMatch(/\.me-reveal\s*\{[^}]*opacity:\s*1/s);
    expect(reducedMotion).toMatch(/\.me-reveal\s*\{[^}]*transition:\s*none/s);
  });
});
