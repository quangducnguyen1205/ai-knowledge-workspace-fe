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
 * Absolute browser URL for the same moment, suitable for the clipboard. The current origin and
 * path are preserved so the link stays valid behind the deployment's base path.
 */
export function buildMomentPermalink(
  assetId: string,
  transcriptRowId: string,
  location?: { origin: string; pathname: string; search: string },
): string {
  const source = location ?? (typeof window === 'undefined' ? undefined : window.location);
  const hash = buildMomentRouteHash(assetId, transcriptRowId);

  if (!source) {
    return hash;
  }

  return `${source.origin}${source.pathname}${source.search}${hash}`;
}
