import { describe, expect, it } from 'vitest';
import { ApiClientError } from '../../../shared/api/api-error';
import {
  getFriendlyRetryErrorCopy,
  getFriendlyYouTubeCreationErrorCopy,
} from './error-copy';

/**
 * The mapping decides *which* copy is shown; the words live in the translation resources. These
 * assertions therefore hold on keys, which keeps them true in every language, and still prove the
 * property that matters: no provider diagnostic survives the mapping.
 */
describe('source creation and retry error copy', () => {
  it.each([
    ['INVALID_YOUTUBE_URL', 'upload:errors.youtubeInvalidUrl.message'],
    ['DUPLICATE_YOUTUBE_ASSET', 'upload:errors.youtubeDuplicate.message'],
  ])('maps stable creation code %s without exposing diagnostics', (code, messageKey) => {
    const copy = getFriendlyYouTubeCreationErrorCopy(new ApiClientError(
      409,
      'provider stderr at https://private.example and stack trace',
      code,
    ));

    expect(copy?.messageKey).toBe(messageKey);
    expect(JSON.stringify(copy)).not.toMatch(/stderr|private\.example|stack trace/i);
  });

  it('maps retry conflict to bounded state-refresh guidance', () => {
    const copy = getFriendlyRetryErrorCopy(new ApiClientError(
      409,
      'internal state and stack trace',
      'ASSET_PROCESSING_RETRY_NOT_ALLOWED',
    ));

    expect(copy).toEqual({
      titleKey: 'viewer:failure.retryNotAllowed.title',
      messageKey: 'viewer:failure.retryNotAllowed.message',
    });
  });
});
