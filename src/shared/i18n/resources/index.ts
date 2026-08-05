/**
 * Every translation resource in the product, assembled once for i18next.
 *
 * **Layout.** One file per namespace, each exporting `{ en, vi }` side by side, rather than one
 * directory per language. With two languages that is the shape that keeps a translation honest:
 * adding a key means writing both halves in the same diff, and a reviewer sees the pair without
 * opening a second file.
 *
 * **Parity is a compile error, not a convention.** Each namespace file declares its Vietnamese
 * half as `const vi: typeof en`, so TypeScript rejects a missing key, a stray key and a wrong
 * nesting shape before any test runs. English is the structural reference because it is also the
 * fallback language. `i18n-parity.test.ts` covers what types cannot see — an empty string, and an
 * interpolation placeholder that exists in one language but not the other.
 *
 * **Plurals.** English carries `_one` / `_other`; Vietnamese does not inflect for number, so both
 * of its forms carry the same text. i18next only ever resolves `_other` for Vietnamese, but the
 * key set stays identical, which is what keeps the parity invariant a single simple rule.
 *
 * **Bundling.** All of it ships in the main chunk. Two languages of UI copy are a few kilobytes;
 * lazy-loading them would add a loading state, a suspense boundary and a class of missing-key
 * races to save less than one image.
 */
import { auth } from './auth';
import { common } from './common';
import { errors } from './errors';
import { home } from './home';
import { landing } from './landing';
import { library } from './library';
import { moments } from './moments';
import { search } from './search';
import { settings } from './settings';
import { shell } from './shell';
import { upload } from './upload';
import { viewer } from './viewer';
import { workspaces } from './workspaces';

/** Namespace registry. The key is the namespace name used in `useTranslation` and in `ns:key`. */
const namespaces = {
  common,
  errors,
  shell,
  auth,
  home,
  library,
  upload,
  workspaces,
  viewer,
  search,
  moments,
  settings,
  landing,
};

export type Namespace = keyof typeof namespaces;

export const NAMESPACES = Object.keys(namespaces) as Namespace[];

/** The namespace `useTranslation()` resolves against when a caller names none. */
export const DEFAULT_NAMESPACE = 'common' satisfies Namespace;

export const enResources = {
  common: common.en,
  errors: errors.en,
  shell: shell.en,
  auth: auth.en,
  home: home.en,
  library: library.en,
  upload: upload.en,
  workspaces: workspaces.en,
  viewer: viewer.en,
  search: search.en,
  moments: moments.en,
  settings: settings.en,
  landing: landing.en,
};

export const viResources: typeof enResources = {
  common: common.vi,
  errors: errors.vi,
  shell: shell.vi,
  auth: auth.vi,
  home: home.vi,
  library: library.vi,
  upload: upload.vi,
  workspaces: workspaces.vi,
  viewer: viewer.vi,
  search: search.vi,
  moments: moments.vi,
  settings: settings.vi,
  landing: landing.vi,
};

export const resources = {
  en: enResources,
  vi: viResources,
};

/** Exposed for the parity test, which walks both halves of every namespace. */
export const namespacePairs = namespaces;
