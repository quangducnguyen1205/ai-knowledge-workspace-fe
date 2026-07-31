/**
 * Public entrypoint of the auth feature for other features. App-level composition uses the auth
 * surfaces directly; features only need the friendly logout copy today.
 */
export { getFriendlyLogoutErrorCopy } from './auth';
