import type { AssetRecordResponse, AssetSummary } from '../model/types';
import { SourceBadge } from './source-badge';

export function AssetSourceDetails({
  asset,
  assetRecord,
}: {
  asset: AssetSummary;
  assetRecord?: AssetRecordResponse;
}) {
  const matchingRecord = assetRecord?.id === asset.assetId ? assetRecord : undefined;

  return (
    <>
      <div><dt>Source</dt><dd><SourceBadge sourceType={asset.sourceType} /></dd></div>
      {asset.sourceType === 'YOUTUBE' && asset.sourceUrl ? (
        <div>
          <dt>YouTube</dt>
          <dd>
            <a
              className="external-source-link"
              href={asset.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open on YouTube <span className="visually-hidden">(opens in a new tab)</span>
              <span aria-hidden="true"> ↗</span>
            </a>
          </dd>
        </div>
      ) : null}
      {asset.sourceType === 'UPLOAD' && matchingRecord?.originalFilename ? (
        <div><dt>Filename</dt><dd>{matchingRecord.originalFilename}</dd></div>
      ) : null}
      {asset.sourceType === 'UPLOAD' && matchingRecord?.contentType ? (
        <div><dt>File type</dt><dd>{matchingRecord.contentType}</dd></div>
      ) : null}
      {asset.sourceType === 'UPLOAD' && matchingRecord?.sizeBytes != null ? (
        <div><dt>File size</dt><dd>{formatFileSize(matchingRecord.sizeBytes)}</dd></div>
      ) : null}
    </>
  );
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1_024) return `${sizeBytes} B`;
  if (sizeBytes < 1_048_576) return `${(sizeBytes / 1_024).toFixed(1)} KB`;
  return `${(sizeBytes / 1_048_576).toFixed(1)} MB`;
}
