import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES, type Language } from './locales';
import { NAMESPACES, namespacePairs, resources, type Namespace } from './resources';

/**
 * Structural validation of the translation resources.
 *
 * The key *sets* are already held identical by TypeScript — each namespace declares its Vietnamese
 * half as `const vi: typeof en`, so a missing or stray key fails the build. This test covers what
 * types cannot see: an entry that exists but is empty, and an interpolation placeholder that one
 * language uses and the other silently drops.
 *
 * A deterministic test is the whole validation pipeline here. Two languages of hand-written copy
 * do not justify an extraction toolchain, and an extractor would not catch either of these.
 */

type Leaf = { path: string; value: string };

function flatten(value: unknown, prefix = ''): Leaf[] {
  if (typeof value === 'string') {
    return [{ path: prefix, value }];
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) =>
      flatten(nested, prefix ? `${prefix}.${key}` : key),
    );
  }

  return [];
}

function placeholdersOf(value: string): string[] {
  return Array.from(value.matchAll(/\{\{\s*([^}\s,]+)/g), (match) => match[1]!).sort();
}

const namespaceLeaves = new Map<Namespace, Map<Language, Leaf[]>>(
  NAMESPACES.map((namespace) => [
    namespace,
    new Map(
      SUPPORTED_LANGUAGES.map((language) => [
        language,
        flatten(namespacePairs[namespace][language]),
      ]),
    ),
  ]),
);

describe('translation resources', () => {
  it('ships exactly the supported languages, with English as the structural reference', () => {
    expect(Object.keys(resources).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
    expect(SUPPORTED_LANGUAGES).toContain('en');
    expect(SUPPORTED_LANGUAGES).toContain('vi');
  });

  it.each(NAMESPACES)('exposes the same key set in every language for "%s"', (namespace) => {
    const byLanguage = namespaceLeaves.get(namespace)!;
    const reference = byLanguage.get('en')!.map((leaf) => leaf.path).sort();

    expect(reference.length).toBeGreaterThan(0);
    for (const language of SUPPORTED_LANGUAGES) {
      expect(byLanguage.get(language)!.map((leaf) => leaf.path).sort(), `${namespace}/${language}`)
        .toEqual(reference);
    }
  });

  it.each(NAMESPACES)('declares each key once in "%s"', (namespace) => {
    for (const language of SUPPORTED_LANGUAGES) {
      const paths = namespaceLeaves.get(namespace)!.get(language)!.map((leaf) => leaf.path);
      expect(new Set(paths).size, `${namespace}/${language}`).toBe(paths.length);
    }
  });

  it.each(NAMESPACES)('has no empty translation in "%s"', (namespace) => {
    for (const language of SUPPORTED_LANGUAGES) {
      const empty = namespaceLeaves.get(namespace)!.get(language)!
        .filter((leaf) => leaf.value.trim().length === 0)
        .map((leaf) => leaf.path);
      expect(empty, `${namespace}/${language}`).toEqual([]);
    }
  });

  it.each(NAMESPACES)('uses the same interpolation variables in every language for "%s"', (namespace) => {
    const byLanguage = namespaceLeaves.get(namespace)!;
    const reference = new Map(
      byLanguage.get('en')!.map((leaf) => [leaf.path, placeholdersOf(leaf.value)]),
    );

    const mismatches: string[] = [];
    for (const language of SUPPORTED_LANGUAGES) {
      if (language === 'en') continue;
      for (const leaf of byLanguage.get(language)!) {
        const expected = reference.get(leaf.path) ?? [];
        const actual = placeholdersOf(leaf.value);
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
          mismatches.push(`${namespace}:${leaf.path} (${language}) expected ${expected} got ${actual}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('pairs every plural key with both forms in every language', () => {
    const missing: string[] = [];

    for (const namespace of NAMESPACES) {
      for (const language of SUPPORTED_LANGUAGES) {
        const paths = new Set(namespaceLeaves.get(namespace)!.get(language)!.map((leaf) => leaf.path));
        for (const path of paths) {
          if (!path.endsWith('_one')) continue;
          const other = `${path.slice(0, -'_one'.length)}_other`;
          if (!paths.has(other)) missing.push(`${namespace}:${other} (${language})`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
