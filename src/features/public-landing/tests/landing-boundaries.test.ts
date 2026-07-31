import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Ownership of the cinematic landing:
 *  - WebGL and animation dependencies never leak outside the landing feature;
 *  - the landing never reaches product APIs, React Query or other features;
 *  - the app mounts the landing only through a lazy route-level import;
 *  - the heavy scene stays out of the landing's own HTML chunk.
 */

const sourceRoot = resolve(process.cwd(), 'src');
const landingRoot = join(sourceRoot, 'features/public-landing');

function productionSources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    if (statSync(absolutePath).isDirectory()) {
      return productionSources(absolutePath);
    }

    if (!['.ts', '.tsx'].includes(extname(entry)) || entry.includes('.test.')) {
      return [];
    }

    return [absolutePath];
  });
}

function importsOf(source: string): string[] {
  return Array.from(source.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g), (match) => match[1]!);
}

describe('landing feature boundaries', () => {
  it('keeps three, react-three and gsap inside the landing feature only', () => {
    const violations: string[] = [];

    for (const absolutePath of productionSources(sourceRoot)) {
      if (absolutePath.startsWith(landingRoot)) continue;
      const source = readFileSync(absolutePath, 'utf8');

      for (const specifier of importsOf(source)) {
        if (/^(three|@react-three\/|gsap)/.test(specifier)) {
          violations.push(`${relative(sourceRoot, absolutePath)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('lets only the app router reach the landing, and only through a lazy import', () => {
    const violations: string[] = [];

    for (const absolutePath of productionSources(sourceRoot)) {
      if (absolutePath.startsWith(landingRoot)) continue;
      const file = relative(sourceRoot, absolutePath);
      const source = readFileSync(absolutePath, 'utf8');

      for (const specifier of importsOf(source)) {
        if (!specifier.includes('public-landing')) continue;
        if (file !== 'app/AppRouter.tsx') {
          violations.push(`${file} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);

    const appRouter = readFileSync(join(sourceRoot, 'app/AppRouter.tsx'), 'utf8');
    expect(appRouter).toMatch(/lazy\(\s*\(\)\s*=>\s*import\('\.\.\/features\/public-landing\/public-landing'\)/);
    expect(appRouter).not.toMatch(/^import .*from '\.\.\/features\/public-landing/m);
  });

  it('keeps the landing free of product APIs, React Query, entities and other features', () => {
    const violations: string[] = [];

    for (const absolutePath of productionSources(landingRoot)) {
      const file = relative(sourceRoot, absolutePath);
      const source = readFileSync(absolutePath, 'utf8');

      for (const specifier of importsOf(source)) {
        const resolved = specifier.startsWith('.') ? resolve(join(absolutePath, '..'), specifier) : specifier;
        const reachesProduct =
          specifier.includes('@tanstack') ||
          /shared\/(api|feedback)/.test(String(resolved)) ||
          /\bentities\//.test(String(resolved)) ||
          (String(resolved).includes(`${sourceRoot}/features/`) && !String(resolved).startsWith(landingRoot));

        if (reachesProduct) {
          violations.push(`${file} -> ${specifier}`);
        }
      }

      if (/fetch\s*\(|['"`]\/api\//.test(source)) {
        violations.push(`${file} performs product requests`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps the heavy scene out of the landing HTML chunk', () => {
    const entry = readFileSync(join(landingRoot, 'public-landing.tsx'), 'utf8');

    // The scene loads only through React.lazy — never statically.
    expect(entry).toMatch(/lazy\(\s*\(\)\s*=>\s*import\('\.\/scene\/moment-engine-canvas'\)\)/);
    expect(entry).not.toMatch(/^import .*from '\.\/scene\/moment-engine-canvas'/m);
    expect(entry).not.toMatch(/from '(three|@react-three\/[^']*|gsap[^']*)'/);

    // Modules reachable from the entry without the lazy boundary must stay 3D-free. GSAP's
    // single owner is the scroll timeline, which only the lazy scene chunk imports.
    const htmlChunkModules = [
      'narrative/narrative-copy.ts',
      'narrative/narrative-section.tsx',
      'narrative/use-reveal.ts',
      'fallback/static-moment-engine.tsx',
      'scene/scene-quality.ts',
    ];

    for (const module of htmlChunkModules) {
      const source = readFileSync(join(landingRoot, module), 'utf8');
      expect(source, module).not.toMatch(/from '(three|@react-three\/[^']*|gsap[^']*)'/);
    }

    const scrollOwner = readFileSync(join(landingRoot, 'narrative/use-scroll-progress.ts'), 'utf8');
    expect(scrollOwner).toMatch(/from 'gsap\/ScrollTrigger'/);
    expect(readFileSync(join(landingRoot, 'scene/moment-engine-canvas.tsx'), 'utf8'))
      .toMatch(/use-scroll-progress/);
  });
});
