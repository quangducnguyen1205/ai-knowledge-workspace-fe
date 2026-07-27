import { describe, expect, it } from 'vitest';
import { ApiClientError } from '../../../shared/api/api-error';
import {
  getFriendlyRetryErrorCopy,
  getFriendlyYouTubeCreationErrorCopy,
} from './error-copy';

describe('source creation and retry error copy', () => {
  it.each([
    [
      'INVALID_YOUTUBE_URL',
      'Enter a supported public YouTube video URL.',
    ],
    [
      'DUPLICATE_YOUTUBE_ASSET',
      'This YouTube video is already in the workspace.',
    ],
  ])('maps stable creation code %s without exposing diagnostics', (code, message) => {
    const copy = getFriendlyYouTubeCreationErrorCopy(new ApiClientError(
      409,
      'provider stderr at https://private.example and stack trace',
      code,
    ));

    expect(copy?.message).toBe(message);
    expect(JSON.stringify(copy)).not.toMatch(/stderr|private\.example|stack trace/i);
  });

  it('maps retry conflict to bounded state-refresh guidance', () => {
    const copy = getFriendlyRetryErrorCopy(new ApiClientError(
      409,
      'internal state and stack trace',
      'ASSET_PROCESSING_RETRY_NOT_ALLOWED',
    ));

    expect(copy).toEqual({
      title: 'Retry no longer available',
      message: 'The video state changed, so processing cannot be retried right now. The latest status is being loaded.',
    });
  });
});
