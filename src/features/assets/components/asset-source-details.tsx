import { useTranslation } from '../../../shared/i18n';
import type { AssetRecordResponse, AssetSummary } from '../model/types';
import { SourceBadge } from './source-badge';

export function AssetSourceDetails({
  asset,
  assetRecord,
}: {
  asset: AssetSummary;
  assetRecord?: AssetRecordResponse;
}) {
  const { t } = useTranslation('viewer');
  const matchingRecord = assetRecord?.id === asset.assetId ? assetRecord : undefined;

  return (
    <>
      <div><dt>{t('details.source')}</dt><dd><SourceBadge sourceType={asset.sourceType} /></dd></div>
      {asset.sourceType === 'YOUTUBE' && asset.sourceUrl ? (
        <div>
          <dt>{t('details.youtube')}</dt>
          <dd>
            <a
              className="external-source-link"
              href={asset.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('details.openOnYouTube')} <span className="visually-hidden">{t('details.opensInNewTab')}</span>
              <span aria-hidden="true"> ↗</span>
            </a>
          </dd>
        </div>
      ) : null}
      {asset.sourceType === 'UPLOAD' && matchingRecord?.originalFilename ? (
        <div><dt>{t('details.filename')}</dt><dd>{matchingRecord.originalFilename}</dd></div>
      ) : null}
      {asset.sourceType === 'UPLOAD' && matchingRecord?.contentType ? (
        <div><dt>{t('details.fileType')}</dt><dd>{matchingRecord.contentType}</dd></div>
      ) : null}
      {asset.sourceType === 'UPLOAD' && matchingRecord?.sizeBytes != null ? (
        <div><dt>{t('details.fileSize')}</dt><dd>{formatFileSize(matchingRecord.sizeBytes)}</dd></div>
      ) : null}
    </>
  );
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1_024) return `${sizeBytes} B`;
  if (sizeBytes < 1_048_576) return `${(sizeBytes / 1_024).toFixed(1)} KB`;
  return `${(sizeBytes / 1_048_576).toFixed(1)} MB`;
}
