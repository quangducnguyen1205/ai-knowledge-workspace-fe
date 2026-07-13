import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');

function readSource(pathFromRoot: string): string {
  return readFileSync(resolve(sourceRoot, pathFromRoot), 'utf8');
}

function productionSources(directory = sourceRoot): string[] {
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

function resolveProductionImport(importer: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(importer), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find((candidate) => existsSync(candidate) && !statSync(candidate).isDirectory()) ?? null;
}

function relativeImports(sourcePath: string): string[] {
  const source = readFileSync(sourcePath, 'utf8');
  const specifiers = Array.from(source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g), (match) => match[1]);
  return specifiers.flatMap((specifier) => resolveProductionImport(sourcePath, specifier) ?? []);
}

describe('frontend import boundaries', () => {
  it('keeps AppShell free of product feature APIs and workflow endpoints', () => {
    const shell = readSource('app/AppShell.tsx');

    expect(shell).not.toMatch(/features\/(assets|upload|search|assistant)\/api/);
    expect(shell).not.toMatch(/\/api\/(assets|search|assistant)/);
    expect(shell).not.toMatch(/use(Asset|Upload|Search|Assistant|Index)/);
  });

  it('keeps shared HTTP neutral and feature APIs pointing inward to it', () => {
    const sharedHttp = readSource('shared/api/http-client.ts');
    const featureApis = [
      'features/auth/api/auth-api.ts',
      'features/workspaces/api/workspaces-api.ts',
      'features/assets/api/assets-api.ts',
      'features/upload/api/upload-api.ts',
      'features/search/api/search-api.ts',
      'features/assistant/api/assistant-api.ts',
    ];

    expect(sharedHttp).not.toMatch(/features\//);
    for (const featureApi of featureApis) {
      expect(readSource(featureApi), featureApi).toMatch(/shared\/api\/http-client/);
    }
  });

  it('contains no browser-to-FastAPI or infrastructure URL in production source', () => {
    const violations = productionSources()
      .map((absolutePath) => ({
        file: relative(sourceRoot, absolutePath),
        source: readFileSync(absolutePath, 'utf8'),
      }))
      .filter(({ source }) => /https?:\/\/[^'"\s]*(?:8000|fastapi)|kafka:\/\/|redis:\/\//i.test(source));

    expect(violations).toEqual([]);
  });

  it('keeps lifecycle independent from assistant and upload independent from polling', () => {
    const lifecycle = readSource('features/assets/hooks/use-asset-lifecycle.ts');
    const upload = readSource('features/upload/hooks/use-asset-upload.ts');

    expect(lifecycle).not.toMatch(/features\/assistant|\.\.\/\.\.\/assistant|useAssetAssistant/);
    expect(upload).not.toMatch(/use-asset-lifecycle|useAssetLifecycle|refetchInterval|setInterval/);
  });

  it('contains no circular production imports', () => {
    const sources = productionSources();
    const sourceSet = new Set(sources);
    const graph = new Map(sources.map((source) => [source, relativeImports(source).filter((target) => sourceSet.has(target))]));
    const active = new Set<string>();
    const complete = new Set<string>();
    const stack: string[] = [];
    const cycles: string[][] = [];

    function visit(source: string) {
      if (complete.has(source)) return;
      if (active.has(source)) {
        const cycleStart = stack.indexOf(source);
        cycles.push([...stack.slice(cycleStart), source].map((path) => relative(sourceRoot, path)));
        return;
      }

      active.add(source);
      stack.push(source);
      for (const target of graph.get(source) ?? []) visit(target);
      stack.pop();
      active.delete(source);
      complete.add(source);
    }

    for (const source of sources) visit(source);
    expect(cycles).toEqual([]);
  });
});
