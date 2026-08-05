/**
 * Which copy an Asset-lifecycle failure shows, as translation keys rather than sentences.
 *
 * Keeping the mapping key-based leaves this module pure — no React, no active language — so the
 * same decision serves both languages and stays unit-testable without an i18n runtime. The words
 * live in the `library`, `upload` and `viewer` namespaces, next to the surfaces that render them.
 */
import { isApiClientError } from '../../../shared/api/api-error';
import type { AssetStatus, ProcessingJobStatus } from './types';

function copyKeys<Namespace extends string, Key extends string>(namespace: Namespace, key: Key) {
  return {
    titleKey: `${namespace}:${key}.title`,
    messageKey: `${namespace}:${key}.message`,
  } as const;
}

function uploadError<Key extends
  'unsupportedFormat' | 'uploadOffline' | 'checkVideo' | 'processingUnavailable'
  | 'youtubeInvalidUrl' | 'youtubeDuplicate' | 'youtubeOffline'
>(key: Key) {
  return copyKeys('upload', `errors.${key}` as const);
}

function libraryError<Key extends
  'deleteGone' | 'deleteSearchUnavailable' | 'deleteOffline' | 'deleteFailed'
  | 'renameInvalidTitle' | 'renameNotFound' | 'renameSearchUnavailable' | 'renameOffline' | 'renameFailed'
>(key: Key) {
  return copyKeys('library', `errors.${key}` as const);
}

function viewerFailure<Key extends string>(key: Key) {
  return copyKeys('viewer', `failure.${key}` as const);
}

function transcriptConflict<Key extends 'conflictFailed' | 'conflictPreparing' | 'conflictWaiting'>(key: Key) {
  return copyKeys('viewer', `transcript.${key}` as const);
}

export type FriendlyMessageKeys = {
  readonly titleKey: string;
  readonly messageKey: string;
};

export function getFriendlyUploadErrorCopy(error: unknown) {
  if (!isApiClientError(error)) return null;
  if (error.status === 400 && error.code === 'INVALID_UPLOAD_FILE') return uploadError('unsupportedFormat');
  if (error.status === 0) return uploadError('uploadOffline');
  if ([400, 409, 413, 415, 422].includes(error.status)) return uploadError('checkVideo');
  if (error.code === 'PROCESSING_SERVICE_UNAVAILABLE' ||
      error.code === 'FASTAPI_INTEGRATION_ERROR' ||
      error.code === 'FASTAPI_CONNECTIVITY_ERROR') {
    return uploadError('processingUnavailable');
  }
  return null;
}

export function getFriendlyYouTubeCreationErrorCopy(error: unknown) {
  if (!isApiClientError(error)) return null;
  if (error.code === 'INVALID_YOUTUBE_URL') return uploadError('youtubeInvalidUrl');
  if (error.code === 'DUPLICATE_YOUTUBE_ASSET') return uploadError('youtubeDuplicate');
  if (error.status === 0) return uploadError('youtubeOffline');
  return null;
}

/** Spring failure codes the Viewer names explicitly; anything else uses the bounded fallback. */
const NAMED_FAILURE_CODES = [
  'YOUTUBE_UNAVAILABLE',
  'YOUTUBE_LIVE_NOT_SUPPORTED',
  'YOUTUBE_DURATION_LIMIT_EXCEEDED',
  'YOUTUBE_SIZE_LIMIT_EXCEEDED',
  'YOUTUBE_ACQUISITION_TIMEOUT',
  'YOUTUBE_ACQUISITION_FAILED',
  'PROCESSING_FAILED',
] as const;

type NamedFailureCode = (typeof NAMED_FAILURE_CODES)[number];

const namedFailureCodes = new Set<string>(NAMED_FAILURE_CODES);

export function getAssetFailureCopy(failureCode: string | null | undefined) {
  return failureCode && namedFailureCodes.has(failureCode)
    ? viewerFailure(failureCode as NamedFailureCode)
    : viewerFailure('unknown');
}

export function getFriendlyRetryErrorCopy(error: unknown) {
  if (!isApiClientError(error)) return null;
  if (error.code === 'ASSET_PROCESSING_RETRY_NOT_ALLOWED') return viewerFailure('retryNotAllowed');
  if (error.status === 0) return viewerFailure('retryOffline');
  return viewerFailure('retryFailed');
}

export function getFriendlyDeleteErrorCopy(error: unknown) {
  if (!isApiClientError(error)) return null;
  if (error.status === 404) return { tone: 'warning', ...libraryError('deleteGone') } as const;
  if (error.code === 'SEARCH_SERVICE_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_INTEGRATION_ERROR') {
    return { tone: 'error', ...libraryError('deleteSearchUnavailable') } as const;
  }
  if (error.status === 0) return { tone: 'error', ...libraryError('deleteOffline') } as const;
  return { tone: 'error', ...libraryError('deleteFailed') } as const;
}

export function getFriendlyRenameErrorCopy(error: unknown) {
  if (!isApiClientError(error)) return null;
  if (error.status === 400 && error.code === 'INVALID_ASSET_TITLE') {
    return { tone: 'warning', ...libraryError('renameInvalidTitle') } as const;
  }
  if (error.status === 404) return { tone: 'warning', ...libraryError('renameNotFound') } as const;
  if (error.code === 'SEARCH_SERVICE_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_INTEGRATION_ERROR') {
    return { tone: 'error', ...libraryError('renameSearchUnavailable') } as const;
  }
  if (error.status === 0) return { tone: 'error', ...libraryError('renameOffline') } as const;
  return { tone: 'error', ...libraryError('renameFailed') } as const;
}

export function getTranscriptConflictCopy(
  error: unknown,
  resolvedAssetStatus: AssetStatus | null,
  processingJobStatus?: ProcessingJobStatus,
) {
  if (!(isApiClientError(error) && error.status === 409)) return null;
  if (resolvedAssetStatus === 'FAILED' || processingJobStatus === 'FAILED') {
    return transcriptConflict('conflictFailed');
  }
  if (processingJobStatus === 'SUCCEEDED' || resolvedAssetStatus === 'TRANSCRIPT_READY') {
    return transcriptConflict('conflictPreparing');
  }
  return transcriptConflict('conflictWaiting');
}

/** `viewer:statusDescription.*` key for an Asset status, for the caller to translate. */
export function getAssetStatusDescriptionKey(status: AssetStatus | null) {
  switch (status) {
    case 'PROCESSING': return 'viewer:statusDescription.PROCESSING' as const;
    case 'TRANSCRIPT_READY': return 'viewer:statusDescription.TRANSCRIPT_READY' as const;
    case 'SEARCHABLE': return 'viewer:statusDescription.SEARCHABLE' as const;
    case 'FAILED': return 'viewer:statusDescription.FAILED' as const;
    default: return 'viewer:statusDescription.unknown' as const;
  }
}
