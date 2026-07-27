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

export function getFriendlyYouTubeCreationErrorCopy(error: unknown): FriendlyMessageCopy | null {
  if (!isApiClientError(error)) return null;
  if (error.code === 'INVALID_YOUTUBE_URL') {
    return {
      title: 'YouTube URL is not supported',
      message: 'Enter a supported public YouTube video URL.',
    };
  }
  if (error.code === 'DUPLICATE_YOUTUBE_ASSET') {
    return {
      title: 'Video already added',
      message: 'This YouTube video is already in the workspace.',
    };
  }
  if (error.status === 0) {
    return {
      title: 'Could not add YouTube video',
      message: 'Check your connection and try again. The video was not added.',
    };
  }
  return null;
}

const ASSET_FAILURE_COPY: Record<string, FriendlyMessageCopy> = {
  YOUTUBE_UNAVAILABLE: {
    title: 'YouTube video unavailable',
    message: 'This YouTube video is unavailable or cannot be accessed.',
  },
  YOUTUBE_LIVE_NOT_SUPPORTED: {
    title: 'Live video not supported',
    message: 'Live YouTube videos are not supported.',
  },
  YOUTUBE_DURATION_LIMIT_EXCEEDED: {
    title: 'Video is too long',
    message: 'This video is longer than the supported limit.',
  },
  YOUTUBE_SIZE_LIMIT_EXCEEDED: {
    title: 'Video is too large',
    message: 'This video is larger than the supported limit.',
  },
  YOUTUBE_ACQUISITION_TIMEOUT: {
    title: 'Video preparation timed out',
    message: 'Downloading this video timed out. Try again later.',
  },
  YOUTUBE_ACQUISITION_FAILED: {
    title: 'Video preparation failed',
    message: 'The video could not be prepared for processing.',
  },
  PROCESSING_FAILED: {
    title: 'Processing failed',
    message: 'Processing failed. You can try again.',
  },
};

export function getAssetFailureCopy(failureCode: string | null | undefined): FriendlyMessageCopy {
  return failureCode && ASSET_FAILURE_COPY[failureCode]
    ? ASSET_FAILURE_COPY[failureCode]
    : {
        title: 'Processing failed',
        message: 'This video could not be processed. You can try again.',
      };
}

export function getFriendlyRetryErrorCopy(error: unknown): FriendlyMessageCopy | null {
  if (!isApiClientError(error)) return null;
  if (error.code === 'ASSET_PROCESSING_RETRY_NOT_ALLOWED') {
    return {
      title: 'Retry no longer available',
      message: 'The video state changed, so processing cannot be retried right now. The latest status is being loaded.',
    };
  }
  if (error.status === 0) {
    return {
      title: 'Could not retry processing',
      message: 'Check your connection and try again.',
    };
  }
  return {
    title: 'Could not retry processing',
    message: 'Processing was not restarted. Try again later.',
  };
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
