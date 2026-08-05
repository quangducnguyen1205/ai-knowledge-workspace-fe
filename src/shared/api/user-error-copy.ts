/**
 * The frontend-owned mapping from a Spring failure to *which* copy the user sees.
 *
 * It resolves translation keys, never sentences: the words live in the `errors` namespace, so the
 * same mapping serves every language and this module stays pure and free of React. The policy it
 * enforces is unchanged — a backend `code` wins over an HTTP status, an unrecognised code falls
 * through to a bounded generic, and no raw message, stack or host detail ever leaves here.
 *
 * Several backend codes describe the same capability failure from different layers; they map onto
 * one key rather than being repeated in the resources.
 */
import { isApiClientError } from './api-error';

/** Codes the `errors:codes.*` resources name directly. */
const DIRECT_CODES = [
  'AUTHENTICATION_REQUIRED',
  'INVALID_CREDENTIALS',
  'EMAIL_ALREADY_REGISTERED',
  'INVALID_EMAIL',
  'INVALID_PASSWORD',
  'INVALID_AUTH_REQUEST',
  'AUTH_MODE_UNAVAILABLE',
  'INVALID_WORKSPACE_NAME',
  'WORKSPACE_NOT_FOUND',
  'DEFAULT_WORKSPACE_DELETE_FORBIDDEN',
  'WORKSPACE_NOT_EMPTY',
  'INVALID_UPLOAD_FILE',
  'INVALID_ASSET_TITLE',
  'ASSET_NOT_FOUND',
  'PROCESSING_JOB_NOT_FOUND',
  'TRANSCRIPT_ROW_NOT_FOUND',
  'PROCESSING_SERVICE_UNAVAILABLE',
  'SEARCH_SERVICE_UNAVAILABLE',
  'STORAGE_SERVICE_UNAVAILABLE',
  'ASSISTANT_SERVICE_UNAVAILABLE',
] as const;

type DirectCode = (typeof DIRECT_CODES)[number];

/** Layer-specific codes that describe a capability failure the product already has copy for. */
const CODE_ALIASES: Record<string, DirectCode> = {
  FASTAPI_CONNECTIVITY_ERROR: 'PROCESSING_SERVICE_UNAVAILABLE',
  FASTAPI_INTEGRATION_ERROR: 'PROCESSING_SERVICE_UNAVAILABLE',
  ELASTICSEARCH_UNAVAILABLE: 'SEARCH_SERVICE_UNAVAILABLE',
  ELASTICSEARCH_INTEGRATION_ERROR: 'SEARCH_SERVICE_UNAVAILABLE',
  OBJECT_STORAGE_ERROR: 'STORAGE_SERVICE_UNAVAILABLE',
  ASSISTANT_PROVIDER_UNAVAILABLE: 'ASSISTANT_SERVICE_UNAVAILABLE',
};

const directCodes = new Set<string>(DIRECT_CODES);

function codeCopy<Code extends DirectCode>(code: Code) {
  return {
    titleKey: `errors:codes.${code}.title`,
    messageKey: `errors:codes.${code}.message`,
  } as const;
}

function groupCopy<
  Group extends 'generic' | 'connection' | 'validation' | 'forbidden' | 'notFound' | 'conflict' | 'serviceUnavailable',
>(group: Group) {
  return {
    titleKey: `errors:${group}.title`,
    messageKey: `errors:${group}.message`,
  } as const;
}

/** A pair of `errors` namespace keys. `shared/feedback` turns it into the sentence a user reads. */
export type UserSafeErrorCopy = ReturnType<typeof getUserSafeErrorCopy>;

export function getUserSafeErrorCopy(error: unknown) {
  if (!isApiClientError(error)) {
    return groupCopy('generic');
  }

  if (error.code) {
    if (directCodes.has(error.code)) return codeCopy(error.code as DirectCode);
    const alias = CODE_ALIASES[error.code];
    if (alias) return codeCopy(alias);
  }

  if (error.status === 0) return groupCopy('connection');
  if ([400, 413, 415, 422].includes(error.status)) return groupCopy('validation');
  if (error.status === 401) return codeCopy('AUTHENTICATION_REQUIRED');
  if (error.status === 403) return groupCopy('forbidden');
  if (error.status === 404) return groupCopy('notFound');
  if (error.status === 409) return groupCopy('conflict');
  if ([502, 503, 504].includes(error.status)) return groupCopy('serviceUnavailable');
  return groupCopy('generic');
}
