import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
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
});
