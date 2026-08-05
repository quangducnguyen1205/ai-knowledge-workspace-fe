/**
 * Binds i18next's `t` to this product's actual resources.
 *
 * The effect is that an unknown key, a misspelled namespace or a wrong nesting path is a compile
 * error rather than a string that renders as its own key at runtime. English is the reference
 * shape because it is the fallback language; Vietnamese is held to the same shape by
 * `resources/index.ts`.
 */
import type { DEFAULT_NAMESPACE, enResources } from './resources';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NAMESPACE;
    resources: typeof enResources;
    returnNull: false;
  }
}
