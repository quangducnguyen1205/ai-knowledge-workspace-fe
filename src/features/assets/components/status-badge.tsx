import type { AssetStatus } from '../model/types';

export function StatusBadge({ status }: { status: AssetStatus | null }) {
  const normalizedStatus = status ?? 'PROCESSING';
  return <span className={`status-badge status-badge--${normalizedStatus.toLowerCase()}`}>{normalizedStatus}</span>;
}
