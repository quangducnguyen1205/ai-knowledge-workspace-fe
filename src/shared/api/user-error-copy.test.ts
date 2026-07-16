import { describe, expect, it } from 'vitest';
import { ApiClientError } from './api-error';
import { getUserSafeErrorCopy } from './user-error-copy';

describe('getUserSafeErrorCopy', () => {
  it('uses a stable backend code before HTTP status', () => {
    expect(getUserSafeErrorCopy(new ApiClientError(
      400,
      'raw provider response from http://internal-service:8000',
      'INVALID_UPLOAD_FILE',
    ))).toEqual({
      title: 'Video format is not supported',
      message: 'Choose an MP4, MOV, M4V, WebM, or AVI video.',
    });
  });

  it('maps capability failures without naming backend implementations', () => {
    const copy = getUserSafeErrorCopy(new ApiClientError(
      503,
      'FastAPI returned HTTP 500 with raw body and Elasticsearch host details',
      'ASSISTANT_SERVICE_UNAVAILABLE',
    ));

    expect(copy.title).toBe('Answers are temporarily unavailable');
    expect(JSON.stringify(copy)).not.toMatch(/FastAPI|Elasticsearch|HTTP 500|raw body/i);
  });

  it('uses HTTP status when the code is unknown', () => {
    expect(getUserSafeErrorCopy(new ApiClientError(404, 'java.package.InternalException', 'UNKNOWN_CODE')))
      .toEqual({
        title: 'Content not found',
        message: 'It no longer exists or you do not have access.',
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
