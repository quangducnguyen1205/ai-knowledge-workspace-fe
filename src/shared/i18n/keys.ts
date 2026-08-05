/**
 * Compile-time key types, so a module that stores keys instead of words can still be checked.
 *
 * This is the seam's answer to "how do I type a key I do not resolve here": a mapping function or
 * a content registry declares `TranslationKey<'viewer'>` rather than `string`, and a typo fails
 * the build exactly as an inline `t('…')` would. Nothing outside `shared/i18n` imports i18next
 * for this — enforced by `src/app/architecture/import-boundaries.test.ts`.
 */
import type { ParseKeys } from 'i18next';
import type { Namespace } from './resources';

/** A key that actually exists in the given namespace. */
export type TranslationKey<Ns extends Namespace = Namespace> = ParseKeys<Ns>;
