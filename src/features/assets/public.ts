/**
 * Public entrypoint of the assets feature — the only path other features may import from.
 *
 * It names the deliberate cross-feature contract (canonical badges, asset domain types, the
 * asset query-key owner, and friendly creation error copy) while everything else in this feature
 * stays internal. Enforced by the feature-boundary test in
 * src/app/architecture/import-boundaries.test.ts; app-level composition is not bound by it.
 */
export { SourceBadge } from './components/source-badge';
export { StatusBadge } from './components/status-badge';
export { assetKeys } from './hooks/asset-queries';
export {
  getFriendlyUploadErrorCopy,
  getFriendlyYouTubeCreationErrorCopy,
} from './model/error-copy';
export type {
  AssetProcessingResponse,
  AssetSourceType,
  AssetStatus,
  AssetSummary,
} from './model/types';
