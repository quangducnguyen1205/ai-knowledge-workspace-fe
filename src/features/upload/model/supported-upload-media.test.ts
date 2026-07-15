import { describe, expect, it } from 'vitest';
import {
  getUploadMediaValidationError,
  SUPPORTED_UPLOAD_MEDIA_ACCEPT,
  SUPPORTED_UPLOAD_MEDIA_MESSAGE,
} from './supported-upload-media';

describe('supported upload media policy', () => {
  it('exposes the supported video formats through the file-input hint', () => {
    expect(SUPPORTED_UPLOAD_MEDIA_ACCEPT).toBe(
      '.mp4,.mov,.m4v,.webm,.avi,video/mp4,video/quicktime,video/x-m4v,video/webm,application/webm,video/x-msvideo,video/avi,video/msvideo',
    );
  });

  it('rejects unsupported extensions even when they claim a video MIME type', () => {
    expect(getUploadMediaValidationError({ name: 'notes.txt', type: 'video/mp4' }))
      .toBe(SUPPORTED_UPLOAD_MEDIA_MESSAGE);
  });

  it.each([
    { name: 'lecture.mp4', type: 'video/mp4' },
    { name: 'lecture.mov', type: 'video/quicktime' },
    { name: 'lecture.mov', type: 'video/mp4' },
    { name: 'lecture.m4v', type: 'video/x-m4v' },
    { name: 'lecture.webm', type: 'video/webm' },
    { name: 'lecture.avi', type: 'video/x-msvideo' },
    { name: 'lecture.mp4', type: '' },
  ])('accepts compatible browser metadata for $name', (file) => {
    expect(getUploadMediaValidationError(file)).toBeNull();
  });

  it('rejects a supported extension with an incompatible specific MIME type', () => {
    expect(getUploadMediaValidationError({ name: 'lecture.mp4', type: 'text/plain' }))
      .toBe(SUPPORTED_UPLOAD_MEDIA_MESSAGE);
  });
});
