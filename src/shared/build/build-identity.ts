/**
 * Bounded frontend build identity.
 *
 * Only a revision string is exposed, and only when the build injected one. Nothing is read from
 * the running environment, so no host, path, credential or configuration value can leak through
 * this surface.
 */
export function resolveAppRevision(): string | null {
  const revision = typeof __APP_REVISION__ === 'string' ? __APP_REVISION__.trim() : '';
  return revision.length > 0 ? revision : null;
}

/** Short, display-safe form of the revision. */
export function formatAppRevision(revision: string | null): string {
  return revision ? revision.slice(0, 12) : 'unknown';
}
