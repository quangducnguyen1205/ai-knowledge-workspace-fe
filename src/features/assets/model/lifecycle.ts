import type { TranscriptRow } from '../../../entities/transcript/model/types';
import { isApiClientError } from '../../../shared/api/api-error';
import type {
  AssetIndexResponse,
  AssetStatus,
  AssetStatusResponse,
  AssetSummary,
  ProcessingJobStatus,
} from './types';

export type IndexActionState = {
  title: string;
  description: string;
  buttonLabel: string;
  buttonTone: 'primary' | 'secondary' | 'ghost';
  canIndex: boolean;
};

export type AssetLifecycleState = {
  step: string;
  summary: string;
  nextAction: string;
  tone: 'info' | 'success' | 'warning';
};

export type AssetLifecycleStep = {
  label: string;
  description: string;
  state: 'complete' | 'current' | 'upcoming' | 'failed';
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
  if (indexResponse?.assetStatus) {
    return indexResponse.assetStatus;
  }

  if (asset?.assetStatus === 'SEARCHABLE' || statusResponse?.assetStatus === 'SEARCHABLE') {
    return 'SEARCHABLE';
  }

  if (transcriptRows?.length) {
    return 'TRANSCRIPT_READY';
  }

  return statusResponse?.assetStatus ?? asset?.assetStatus ?? null;
}

export function getIndexActionState(input: {
  resolvedAssetStatus: AssetStatus | null;
  processingJobStatus?: ProcessingJobStatus;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
}): IndexActionState | null {
  const transcriptRowCount = input.transcriptRows?.length ?? 0;

  if (input.resolvedAssetStatus === 'SEARCHABLE') {
    return null;
  }

  if (transcriptRowCount > 0 && input.resolvedAssetStatus === 'TRANSCRIPT_READY') {
    return {
      title: 'Indexing fallback',
      description: `${transcriptRowCount} transcript row${transcriptRowCount === 1 ? '' : 's'} loaded. Automatic indexing has not completed, so you can run the fallback action now.`,
      buttonLabel: 'Index transcript',
      buttonTone: 'secondary',
      canIndex: true,
    };
  }

  if (input.resolvedAssetStatus === 'FAILED' || input.processingJobStatus === 'FAILED') {
    return {
      title: 'Indexing unavailable',
      description: 'Processing failed for this asset, so there is no transcript available to index.',
      buttonLabel: 'Indexing unavailable',
      buttonTone: 'ghost',
      canIndex: false,
    };
  }

  if (input.resolvedAssetStatus === 'PROCESSING' || !isTerminalProcessing(input.processingJobStatus)) {
    return {
      title: 'Indexing unavailable',
      description: 'Wait for processing to finish and the transcript to load before indexing becomes available.',
      buttonLabel: 'Waiting for transcript',
      buttonTone: 'ghost',
      canIndex: false,
    };
  }

  if (isApiClientError(input.transcriptError) && input.transcriptError.status === 409) {
    return {
      title: 'Indexing unavailable',
      description: 'Transcript rows are still unavailable for this asset, so indexing stays disabled for now.',
      buttonLabel: 'Transcript unavailable',
      buttonTone: 'ghost',
      canIndex: false,
    };
  }

  return {
    title: 'Indexing unavailable',
    description: 'Transcript rows must be available before indexing can begin.',
    buttonLabel: 'Indexing unavailable',
    buttonTone: 'ghost',
    canIndex: false,
  };
}

export function getAssetLifecycleState(input: {
  resolvedAssetStatus: AssetStatus | null;
  processingJobStatus?: ProcessingJobStatus;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
}): AssetLifecycleState {
  const transcriptRowCount = input.transcriptRows?.length ?? 0;

  if (input.resolvedAssetStatus === 'SEARCHABLE') {
    return {
      step: 'Searchable',
      summary: 'This asset is indexed and can now participate in workspace search.',
      nextAction: 'Run a search and open transcript context around the most relevant hit.',
      tone: 'success',
    };
  }

  if (transcriptRowCount > 0) {
    return {
      step: 'Waiting for search',
      summary: `${transcriptRowCount} transcript row${transcriptRowCount === 1 ? '' : 's'} loaded for this asset.`,
      nextAction: 'Automatic indexing should finish next. Use the indexing fallback only if the asset does not advance.',
      tone: 'warning',
    };
  }

  if (input.resolvedAssetStatus === 'FAILED' || input.processingJobStatus === 'FAILED') {
    return {
      step: 'Failed',
      summary: 'This asset cannot continue because processing failed.',
      nextAction: 'Select another asset in the workspace or upload a new file.',
      tone: 'warning',
    };
  }

  if (isApiClientError(input.transcriptError) && input.transcriptError.status === 409) {
    return {
      step: 'Transcript pending',
      summary: 'Processing finished, but transcript rows are still unavailable.',
      nextAction: 'Stay on this asset until transcript rows appear. Indexing remains unavailable for now.',
      tone: 'warning',
    };
  }

  if (input.resolvedAssetStatus === 'PROCESSING' || !isTerminalProcessing(input.processingJobStatus)) {
    return {
      step: 'Processing',
      summary: 'This asset is still being processed, so transcript review and indexing are not ready yet.',
      nextAction: 'Keep this asset selected to watch for transcript readiness and the next action.',
      tone: 'warning',
    };
  }

  return {
    step: 'Uploaded',
    summary: 'The asset is selected and waiting for its first processing update.',
    nextAction: 'Keep the asset selected so status, transcript, and indexing state stay in sync.',
    tone: 'info',
  };
}

export function getLifecycleSteps(input: {
  resolvedAssetStatus: AssetStatus | null;
  processingJobStatus?: ProcessingJobStatus;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
}): AssetLifecycleStep[] {
  const transcriptRowCount = input.transcriptRows?.length ?? 0;
  const processingFailed = input.resolvedAssetStatus === 'FAILED' || input.processingJobStatus === 'FAILED';
  const processingComplete =
    !processingFailed &&
    (isTerminalProcessing(input.processingJobStatus) ||
      input.resolvedAssetStatus === 'TRANSCRIPT_READY' ||
      input.resolvedAssetStatus === 'SEARCHABLE' ||
      transcriptRowCount > 0);
  const transcriptReady =
    transcriptRowCount > 0 || input.resolvedAssetStatus === 'TRANSCRIPT_READY' || input.resolvedAssetStatus === 'SEARCHABLE';
  const transcriptPending =
    !processingFailed &&
    !transcriptReady &&
    ((isApiClientError(input.transcriptError) && input.transcriptError.status === 409) ||
      input.processingJobStatus === 'SUCCEEDED');

  return [
    { label: 'Uploaded', description: 'Asset saved to the workspace.', state: 'complete' },
    {
      label: 'Processing',
      description: processingFailed ? 'Processing failed.' : processingComplete ? 'Processing finished.' : 'Preparing transcript content.',
      state: processingFailed ? 'failed' : processingComplete ? 'complete' : 'current',
    },
    {
      label: 'Transcript',
      description: transcriptReady
        ? `${transcriptRowCount || 1} row${transcriptRowCount === 1 ? '' : 's'} ready.`
        : transcriptPending ? 'Waiting for transcript rows.' : 'Transcript not ready yet.',
      state: processingFailed ? 'upcoming' : transcriptReady ? 'complete' : transcriptPending ? 'current' : 'upcoming',
    },
    {
      label: 'Search',
      description: input.resolvedAssetStatus === 'SEARCHABLE'
        ? 'Indexed and searchable.'
        : transcriptReady ? 'Automatic indexing in progress; fallback available.' : 'Search is locked.',
      state: input.resolvedAssetStatus === 'SEARCHABLE'
        ? 'complete'
        : processingFailed ? 'upcoming' : transcriptReady ? 'current' : 'upcoming',
    },
  ];
}
