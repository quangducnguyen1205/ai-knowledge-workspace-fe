import type { AssetStatus } from '../model/types';

export function StatusBadge({ status }: { status: AssetStatus | null }) {
  const normalizedStatus = status ?? 'PROCESSING';
  const label = {
    PROCESSING: 'Processing video',
    TRANSCRIPT_READY: 'Preparing search',
    SEARCHABLE: 'Ready',
    FAILED: 'Processing failed',
  }[normalizedStatus];

  return <span className={`status-badge status-badge--${normalizedStatus.toLowerCase()}`}>{label}</span>;
}
