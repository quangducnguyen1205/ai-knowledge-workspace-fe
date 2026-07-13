import { ApiClientError, isApiClientError } from '../../../shared/api/api-error';
import type { AssetStatus, ProcessingJobStatus } from './types';

export type FriendlyMessageCopy = {
  title: string;
  message: string;
  detail?: string;
};

function getTechnicalDetail(error: ApiClientError): string | undefined {
  const normalizedMessage = error.message.trim();
  if (!normalizedMessage) return undefined;
  if (['bad request', 'conflict', 'unsupported media type', 'unprocessable entity'].includes(normalizedMessage.toLowerCase())) {
    return error.code ? `Backend detail: ${error.code}` : undefined;
  }
  return error.code ? `Backend detail: ${error.code} - ${normalizedMessage}` : `Backend detail: ${normalizedMessage}`;
}

export function getFriendlyUploadErrorCopy(error: unknown): FriendlyMessageCopy | null {
  if (!isApiClientError(error)) return null;
  if (error.status === 0) {
    return { title: 'Upload is temporarily unavailable', message: 'We could not reach the service, so the upload did not start.' };
  }
  if ([400, 409, 413, 415, 422].includes(error.status)) {
    return {
      title: 'Upload was rejected',
      message: 'This file could not be accepted for processing. Try a supported lecture video file and confirm the active workspace is still valid.',
      detail: getTechnicalDetail(error),
    };
  }
  if ((error.status === 502 && error.code === 'FASTAPI_INTEGRATION_ERROR') ||
      (error.status === 504 && error.code === 'FASTAPI_CONNECTIVITY_ERROR')) {
    return {
      title: 'Upload could not start processing',
      message: 'The current processing path could not accept this file right now. Use a supported lecture video file and try again.',
      detail: getTechnicalDetail(error),
    };
  }
  return null;
}

export function getFriendlyDeleteErrorCopy(error: unknown): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) return null;
  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Asset already removed',
      message: 'This asset no longer exists. The workspace list will refresh and clear any stale selection.',
      detail: getTechnicalDetail(error),
    };
  }
  if ((error.status === 503 && error.code === 'ELASTICSEARCH_UNAVAILABLE') ||
      (error.status === 502 && error.code === 'ELASTICSEARCH_INTEGRATION_ERROR')) {
    return {
      tone: 'error',
      title: 'Delete could not finish',
      message: 'The asset could not be removed because search infrastructure is unavailable right now. It will stay visible until deletion is confirmed.',
      detail: getTechnicalDetail(error),
    };
  }
  if (error.status === 0) {
    return { tone: 'error', title: 'Delete is temporarily unavailable', message: 'We could not reach the service, so this asset was not removed.' };
  }
  return {
    tone: 'error',
    title: 'Delete failed',
    message: 'The asset was not removed. The current list stays in place until deletion is confirmed.',
    detail: getTechnicalDetail(error),
  };
}

export function getFriendlyRenameErrorCopy(error: unknown): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) return null;
  if (error.status === 400 && error.code === 'INVALID_ASSET_TITLE') {
    return {
      tone: 'warning',
      title: 'Title was rejected',
      message: 'Use a clear non-empty title within the current length limit, then save again.',
      detail: getTechnicalDetail(error),
    };
  }
  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Asset no longer exists',
      message: 'This asset could not be found anymore. The workspace list will refresh and clear stale selection if needed.',
      detail: getTechnicalDetail(error),
    };
  }
  if ((error.status === 503 && error.code === 'ELASTICSEARCH_UNAVAILABLE') ||
      (error.status === 502 && error.code === 'ELASTICSEARCH_INTEGRATION_ERROR')) {
    return {
      tone: 'error',
      title: 'Rename could not finish',
      message: 'The title could not be updated right now, so the previous title stays in place until the change is confirmed.',
      detail: getTechnicalDetail(error),
    };
  }
  if (error.status === 0) {
    return { tone: 'error', title: 'Rename is temporarily unavailable', message: 'We could not reach the service, so this title was not updated.' };
  }
  return {
    tone: 'error',
    title: 'Rename failed',
    message: 'The title update was not confirmed, so the previous title is still shown.',
    detail: getTechnicalDetail(error),
  };
}

export function getTranscriptConflictCopy(
  error: unknown,
  resolvedAssetStatus: AssetStatus | null,
  processingJobStatus?: ProcessingJobStatus,
): FriendlyMessageCopy | null {
  if (!(isApiClientError(error) && error.status === 409)) return null;
  if (resolvedAssetStatus === 'FAILED' || processingJobStatus === 'FAILED') {
    return {
      title: 'Transcript is unavailable for this asset',
      message: 'Processing failed, so there are no transcript rows available to review or index.',
      detail: getTechnicalDetail(error),
    };
  }
  if (processingJobStatus === 'SUCCEEDED' || resolvedAssetStatus === 'TRANSCRIPT_READY') {
    return {
      title: 'Transcript is still being prepared',
      message: 'Processing finished, but transcript rows are not available yet. Indexing stays disabled until the transcript is ready.',
      detail: getTechnicalDetail(error),
    };
  }
  return {
    title: 'Transcript is still being prepared',
    message: 'Transcript rows are not available yet. Wait for processing to finish before indexing.',
    detail: getTechnicalDetail(error),
  };
}

export function getAssetStatusDescription(status: AssetStatus | null): string {
  switch (status) {
    case 'PROCESSING': return 'Processing the source and preparing transcript content.';
    case 'TRANSCRIPT_READY': return 'Transcript is ready. Search indexing normally completes automatically.';
    case 'SEARCHABLE': return 'Indexed and searchable inside this workspace.';
    case 'FAILED': return 'Processing failed for this asset.';
    default: return 'Asset state not available yet.';
  }
}
