import { useTranslation } from '../../../shared/i18n';
import type { AssetStatus } from '../model/types';

/** Canonical Asset status presentation. The `AssetStatus` value is Spring's contract and is never
 * translated; only its label is. */
export function StatusBadge({ status }: { status: AssetStatus | null }) {
  const { t } = useTranslation('library');
  const normalizedStatus = status ?? 'PROCESSING';

  return (
    <span className={`status-badge status-badge--${normalizedStatus.toLowerCase()}`}>
      {t(`status.${normalizedStatus}`)}
    </span>
  );
}
