import { isApiClientError } from './api-error';

export type UserSafeErrorCopy = {
  title: string;
  message: string;
};

const COPY_BY_CODE: Record<string, UserSafeErrorCopy> = {
  AUTHENTICATION_REQUIRED: {
    title: 'Sign in required',
    message: 'Your session is no longer valid. Sign in again to continue.',
  },
  INVALID_CREDENTIALS: {
    title: 'Email or password is incorrect',
    message: 'Check your details and try again.',
  },
  EMAIL_ALREADY_REGISTERED: {
    title: 'Email already registered',
    message: 'Sign in with this email or use a different address.',
  },
  INVALID_EMAIL: { title: 'Enter a valid email', message: 'Use a complete email address and try again.' },
  INVALID_PASSWORD: { title: 'Password is not valid', message: 'Check the password requirements and try again.' },
  INVALID_AUTH_REQUEST: { title: 'Complete the form', message: 'Check the fields and submit again.' },
  AUTH_MODE_UNAVAILABLE: { title: 'Sign in is unavailable', message: 'The current sign-in method is temporarily unavailable.' },
  INVALID_WORKSPACE_NAME: { title: 'Workspace name is not valid', message: 'Enter a non-empty name within the allowed length.' },
  WORKSPACE_NOT_FOUND: { title: 'Workspace not found', message: 'It no longer exists or you do not have access.' },
  DEFAULT_WORKSPACE_DELETE_FORBIDDEN: { title: 'Default workspace cannot be deleted', message: 'The default workspace is protected.' },
  WORKSPACE_NOT_EMPTY: { title: 'Workspace still contains videos', message: 'Delete its videos before trying again.' },
  INVALID_UPLOAD_FILE: { title: 'Video format is not supported', message: 'Choose an MP4, MOV, M4V, WebM, or AVI video.' },
  INVALID_ASSET_TITLE: { title: 'Video title is not valid', message: 'Enter a non-empty title within the allowed length.' },
  ASSET_NOT_FOUND: { title: 'Video not found', message: 'It no longer exists or you do not have access.' },
  PROCESSING_JOB_NOT_FOUND: { title: 'Video status is unavailable', message: 'Reload the page to get the latest status.' },
  TRANSCRIPT_ROW_NOT_FOUND: { title: 'Transcript moment not found', message: 'The selected moment is no longer available.' },
  PROCESSING_SERVICE_UNAVAILABLE: { title: 'Video processing is unavailable', message: 'The video was not sent for processing. Try again later.' },
  FASTAPI_CONNECTIVITY_ERROR: { title: 'Video processing is unavailable', message: 'The video was not sent for processing. Try again later.' },
  FASTAPI_INTEGRATION_ERROR: { title: 'Video processing is unavailable', message: 'The video was not sent for processing. Try again later.' },
  SEARCH_SERVICE_UNAVAILABLE: { title: 'Search is temporarily unavailable', message: 'Try your search again later.' },
  ELASTICSEARCH_UNAVAILABLE: { title: 'Search is temporarily unavailable', message: 'Try your search again later.' },
  ELASTICSEARCH_INTEGRATION_ERROR: { title: 'Search is temporarily unavailable', message: 'Try your search again later.' },
  STORAGE_SERVICE_UNAVAILABLE: { title: 'Upload is temporarily unavailable', message: 'The video was not saved. Try again later.' },
  OBJECT_STORAGE_ERROR: { title: 'Upload is temporarily unavailable', message: 'The video was not saved. Try again later.' },
  ASSISTANT_SERVICE_UNAVAILABLE: { title: 'Answers are temporarily unavailable', message: 'You can still read and search the transcript.' },
  ASSISTANT_PROVIDER_UNAVAILABLE: { title: 'Answers are temporarily unavailable', message: 'You can still read and search the transcript.' },
};

export function getUserSafeErrorCopy(error: unknown): UserSafeErrorCopy {
  if (!isApiClientError(error)) {
    return { title: 'Something went wrong', message: 'The action could not be completed. Try again later.' };
  }

  if (error.code && COPY_BY_CODE[error.code]) return COPY_BY_CODE[error.code];
  if (error.status === 0) return { title: 'Could not connect', message: 'Check your connection and try again.' };
  if ([400, 413, 415, 422].includes(error.status)) return { title: 'Check your information', message: 'Review what you entered and try again.' };
  if (error.status === 401) return COPY_BY_CODE.AUTHENTICATION_REQUIRED;
  if (error.status === 403) return { title: 'Action not allowed', message: 'You do not have access to complete this action.' };
  if (error.status === 404) return { title: 'Content not found', message: 'It no longer exists or you do not have access.' };
  if (error.status === 409) return { title: 'Action not available', message: 'The current state does not allow this action. Check again and retry.' };
  if ([502, 503, 504].includes(error.status)) return { title: 'Service temporarily unavailable', message: 'Try again later.' };
  return { title: 'Something went wrong', message: 'The action could not be completed. Try again later.' };
}
