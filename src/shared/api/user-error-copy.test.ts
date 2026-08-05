import { describe, expect, it } from 'vitest';
import { ApiClientError } from './api-error';
import { getUserSafeErrorCopy } from './user-error-copy';

/**
 * The mapper resolves *which* copy is shown, not the words. Asserting keys keeps this test
 * language-independent; that every key resolves to real text in both languages is covered by
 * `shared/i18n/i18n-parity.test.ts`.
 */
describe('getUserSafeErrorCopy', () => {
  it('uses a stable backend code before HTTP status', () => {
    expect(getUserSafeErrorCopy(new ApiClientError(
      400,
      'raw provider response from http://internal-service:8000',
      'INVALID_UPLOAD_FILE',
    ))).toEqual({
      titleKey: 'errors:codes.INVALID_UPLOAD_FILE.title',
      messageKey: 'errors:codes.INVALID_UPLOAD_FILE.message',
    });
  });

  it('maps capability failures without naming backend implementations', () => {
    const copy = getUserSafeErrorCopy(new ApiClientError(
      503,
      'FastAPI returned HTTP 500 with raw body and Elasticsearch host details',
      'ASSISTANT_SERVICE_UNAVAILABLE',
    ));

    expect(copy.titleKey).toBe('errors:codes.ASSISTANT_SERVICE_UNAVAILABLE.title');
    expect(JSON.stringify(copy)).not.toMatch(/FastAPI|HTTP 500|raw body/i);
  });

  it('folds a layer-specific code onto the capability copy the product already owns', () => {
    expect(getUserSafeErrorCopy(new ApiClientError(500, 'connection refused', 'ELASTICSEARCH_INTEGRATION_ERROR')))
      .toEqual({
        titleKey: 'errors:codes.SEARCH_SERVICE_UNAVAILABLE.title',
        messageKey: 'errors:codes.SEARCH_SERVICE_UNAVAILABLE.message',
      });
  });

  it('uses HTTP status when the code is unknown', () => {
    expect(getUserSafeErrorCopy(new ApiClientError(404, 'java.package.InternalException', 'UNKNOWN_CODE')))
      .toEqual({
        titleKey: 'errors:notFound.title',
        messageKey: 'errors:notFound.message',
      });
  });

  it('never returns raw JavaScript or backend exception text', () => {
    const backendCopy = getUserSafeErrorCopy(new ApiClientError(500, 'SQLException password=secret'));
    const browserCopy = getUserSafeErrorCopy(new Error('TypeError at /private/local/path'));

    expect(JSON.stringify(backendCopy)).not.toContain('SQLException');
    expect(JSON.stringify(backendCopy)).not.toContain('secret');
    expect(JSON.stringify(browserCopy)).not.toContain('/private/local/path');
  });
});
