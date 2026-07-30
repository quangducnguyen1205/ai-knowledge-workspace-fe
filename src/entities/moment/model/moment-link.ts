import { routeToHash } from '../../../app/router';

/**
 * Canonical permalink for one video moment.
 *
 * The link carries only the Asset and the canonical transcript-row identity, so it resolves from
 * a cold browser: no search origin, no query, no cached results and no previously selected
 * Workspace. It is an authenticated product link, not anonymous public sharing.
 */
export function buildMomentRouteHash(assetId: string, transcriptRowId: string): string {
  return routeToHash({ name: 'asset', assetId, transcriptRowId });
}

/**
 * Absolute browser URL for the same moment, suitable for the clipboard.
 *
 * The contract is deliberately `origin + pathname + canonical Asset hash`. Origin and the
 * deployment pathname are preserved so the link stays valid behind a base path, but the current
 * page's query string is never copied: it can carry OAuth/OIDC callback values such as `code`,
 * `state` or `session_state`, or transient search state, none of which belong in a durable
 * bookmark. No product contract places tenancy in the query string.
 */
export function buildMomentPermalink(
  assetId: string,
  transcriptRowId: string,
  location?: { origin: string; pathname: string },
): string {
  const source = location ?? (typeof window === 'undefined' ? undefined : window.location);
  const hash = buildMomentRouteHash(assetId, transcriptRowId);

  if (!source) {
    return hash;
  }

  return `${source.origin}${source.pathname}${hash}`;
}
