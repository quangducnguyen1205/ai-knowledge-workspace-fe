import type { TranscriptRow } from '../../../entities/transcript/model/types';
import type {
  AssetIndexResponse,
  AssetStatus,
  AssetStatusResponse,
  AssetSummary,
  ProcessingJobStatus,
} from './types';

/** Translation keys plus presentation, so the decision stays free of any active language. */
export type IndexActionState = {
  titleKey: 'viewer:recovery.indexTitle';
  descriptionKey: 'viewer:recovery.indexDescription';
  buttonLabelKey: 'viewer:recovery.indexAction';
  buttonTone: 'secondary';
  canIndex: true;
};

export function isTerminalProcessing(status: ProcessingJobStatus | undefined): boolean {
  return status === 'SUCCEEDED' || status === 'FAILED';
}

export function shouldPollAssetStatus(status: AssetStatus | null | undefined): boolean {
  return status === 'PROCESSING' || status === 'TRANSCRIPT_READY';
}

export function canLoadTranscript(assetStatus: AssetStatus | null, processingJobStatus?: string): boolean {
  return assetStatus === 'TRANSCRIPT_READY' || assetStatus === 'SEARCHABLE' || processingJobStatus === 'SUCCEEDED';
}

export function deriveAssetStatus(
  asset: AssetSummary | null,
  statusResponse: AssetStatusResponse | undefined,
  transcriptRows: TranscriptRow[] | undefined,
  indexResponse: AssetIndexResponse | undefined,
): AssetStatus | null {
  if (indexResponse?.assetStatus) return indexResponse.assetStatus;
  if (asset?.assetStatus === 'SEARCHABLE' || statusResponse?.assetStatus === 'SEARCHABLE') return 'SEARCHABLE';
  if (statusResponse?.assetStatus === 'FAILED' || (!statusResponse && asset?.assetStatus === 'FAILED')) return 'FAILED';
  if (transcriptRows?.length) return 'TRANSCRIPT_READY';
  return statusResponse?.assetStatus ?? asset?.assetStatus ?? null;
}

export function getIndexActionState(input: {
  resolvedAssetStatus: AssetStatus | null;
  processingJobStatus?: ProcessingJobStatus;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
}): IndexActionState | null {
  if (input.resolvedAssetStatus !== 'TRANSCRIPT_READY' || !input.transcriptRows?.length) return null;

  return {
    titleKey: 'viewer:recovery.indexTitle',
    descriptionKey: 'viewer:recovery.indexDescription',
    buttonLabelKey: 'viewer:recovery.indexAction',
    buttonTone: 'secondary',
    canIndex: true,
  };
}
