import { useTranslation } from '../../../shared/i18n';
import type { AssetSourceType } from '../model/types';

const SOURCE_TYPES: readonly AssetSourceType[] = ['UPLOAD', 'YOUTUBE'];

/**
 * Canonical Asset source presentation. A missing or unrecognized source renders the bounded
 * unknown badge here, so no caller re-implements the fallback. The `AssetSourceType` value is
 * Spring's contract and is never translated; only its label is.
 */
export function SourceBadge({ sourceType }: { sourceType: AssetSourceType | null }) {
  const { t } = useTranslation('library');

  if (!sourceType || !SOURCE_TYPES.includes(sourceType)) {
    return <span className="source-badge source-badge--unknown">{t('source.unknown')}</span>;
  }

  return <span className="source-badge">{t(`source.${sourceType}`)}</span>;
}
