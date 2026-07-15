export const SUPPORTED_UPLOAD_MEDIA_ACCEPT = [
  '.mp4',
  '.mov',
  '.m4v',
  '.webm',
  '.avi',
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/webm',
  'application/webm',
  'video/x-msvideo',
  'video/avi',
  'video/msvideo',
].join(',');

export const SUPPORTED_UPLOAD_MEDIA_MESSAGE = 'Choose an MP4, MOV, M4V, WebM, or AVI video file.';

const GENERIC_CONTENT_TYPES = new Set(['', 'application/octet-stream', 'video/*']);

const supportedMediaTypesByExtension: Record<string, ReadonlySet<string>> = {
  mp4: new Set(['video/mp4', 'video/quicktime', 'video/x-m4v']),
  mov: new Set(['video/mp4', 'video/quicktime', 'video/x-m4v']),
  m4v: new Set(['video/mp4', 'video/quicktime', 'video/x-m4v']),
  webm: new Set(['video/webm', 'application/webm']),
  avi: new Set(['video/x-msvideo', 'video/avi', 'video/msvideo']),
};

export function getUploadMediaValidationError(
  file: Pick<File, 'name' | 'type'> | null,
): string | null {
  if (!file) return 'Choose a video file before uploading.';

  const extension = extensionOf(file.name);
  const supportedMediaTypes = extension ? supportedMediaTypesByExtension[extension] : undefined;
  if (!supportedMediaTypes) return SUPPORTED_UPLOAD_MEDIA_MESSAGE;

  const contentType = normalizeContentType(file.type);
  if (GENERIC_CONTENT_TYPES.has(contentType) || supportedMediaTypes.has(contentType)) return null;

  return SUPPORTED_UPLOAD_MEDIA_MESSAGE;
}

function extensionOf(filename: string): string | null {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === filename.length - 1) return null;
  return filename.slice(dotIndex + 1).toLowerCase();
}

function normalizeContentType(contentType: string): string {
  return contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}
