import type { AssetSourceType } from '../model/types';

const SOURCE_LABELS: Record<AssetSourceType, string> = {
  UPLOAD: 'Upload',
  YOUTUBE: 'YouTube',
};

/**
 * Canonical Asset source presentation. A missing or unrecognized source renders the bounded
 * unknown badge here, so no caller re-implements the fallback.
 */
export function SourceBadge({ sourceType }: { sourceType: AssetSourceType | null }) {
  const label = sourceType ? SOURCE_LABELS[sourceType] : undefined;

  if (!label) {
    return <span className="source-badge source-badge--unknown">Source unavailable</span>;
  }

  return <span className="source-badge">{label}</span>;
}
