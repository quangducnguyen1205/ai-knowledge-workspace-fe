import type { AssetSourceType } from '../model/types';

const SOURCE_LABELS: Record<AssetSourceType, string> = {
  UPLOAD: 'Upload',
  YOUTUBE: 'YouTube',
};

export function SourceBadge({ sourceType }: { sourceType: AssetSourceType }) {
  return <span className="source-badge">{SOURCE_LABELS[sourceType] ?? 'Unknown source'}</span>;
}
