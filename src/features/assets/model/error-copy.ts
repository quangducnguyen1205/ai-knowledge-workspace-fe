import { isApiClientError } from '../../../shared/api/api-error';
import type { AssetStatus, ProcessingJobStatus } from './types';

export type FriendlyMessageCopy = {
  title: string;
  message: string;
  detail?: string;
};

export function getFriendlyUploadErrorCopy(error: unknown): FriendlyMessageCopy | null {
  if (!isApiClientError(error)) return null;
  if (error.status === 400 && error.code === 'INVALID_UPLOAD_FILE') {
    return {
      title: 'Video format is not supported',
      message: 'Choose an MP4, MOV, M4V, WebM, or AVI video.',
    };
  }
  if (error.status === 0) {
    return { title: 'Could not upload video', message: 'Check your connection and try again. The video was not uploaded.' };
  }
  if ([400, 409, 413, 415, 422].includes(error.status)) {
    return {
      title: 'Check this video',
      message: 'Check the video format and current workspace, then try again.',
    };
  }
  if (error.code === 'PROCESSING_SERVICE_UNAVAILABLE' ||
      error.code === 'FASTAPI_INTEGRATION_ERROR' ||
      error.code === 'FASTAPI_CONNECTIVITY_ERROR') {
    return {
      title: 'Video processing is unavailable',
      message: 'The video was not sent for processing. Try again later.',
    };
  }
  return null;
}

export function getFriendlyDeleteErrorCopy(error: unknown): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) return null;
  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Video already deleted',
      message: 'The library will refresh to remove it.',
    };
  }
  if (error.code === 'SEARCH_SERVICE_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_INTEGRATION_ERROR') {
    return {
      tone: 'error',
      title: 'Could not delete video',
      message: 'Search is temporarily unavailable. The video was not deleted.',
    };
  }
  if (error.status === 0) {
    return { tone: 'error', title: 'Could not delete video', message: 'Check your connection and try again. The video was not deleted.' };
  }
  return {
    tone: 'error',
    title: 'Could not delete video',
    message: 'The video was not deleted. Try again later.',
  };
}

export function getFriendlyRenameErrorCopy(error: unknown): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) return null;
  if (error.status === 400 && error.code === 'INVALID_ASSET_TITLE') {
    return {
      tone: 'warning',
      title: 'Video title is not valid',
      message: 'Enter a non-empty title within the allowed length.',
    };
  }
  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Video not found',
      message: 'It no longer exists or you do not have access.',
    };
  }
  if (error.code === 'SEARCH_SERVICE_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_INTEGRATION_ERROR') {
    return {
      tone: 'error',
      title: 'Could not rename video',
      message: 'Search is temporarily unavailable, so the previous title was kept.',
    };
  }
  if (error.status === 0) {
    return { tone: 'error', title: 'Could not rename video', message: 'Check your connection and try again. The previous title was kept.' };
  }
  return {
    tone: 'error',
    title: 'Could not rename video',
    message: 'The previous title was kept. Try again later.',
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
      title: 'Transcript unavailable',
      message: 'Processing failed, so there is no transcript to review.',
    };
  }
  if (processingJobStatus === 'SUCCEEDED' || resolvedAssetStatus === 'TRANSCRIPT_READY') {
    return {
      title: 'Preparing transcript',
      message: 'The video finished processing, but its transcript is not ready yet.',
    };
  }
  return {
    title: 'Preparing transcript',
    message: 'Wait for video processing to finish.',
  };
}

export function getAssetStatusDescription(status: AssetStatus | null): string {
  switch (status) {
    case 'PROCESSING': return 'Preparing this video and its transcript.';
    case 'TRANSCRIPT_READY': return 'The transcript is ready while search preparation finishes.';
    case 'SEARCHABLE': return 'Ready to search and ask questions about.';
    case 'FAILED': return 'This video could not be processed.';
    default: return 'Video status is not available yet.';
  }
}
