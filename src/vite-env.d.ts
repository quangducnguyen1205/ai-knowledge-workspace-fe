/// <reference types="vite/client" />

/**
 * Supported client-runtime configuration, merged into the interface `vite/client` declares.
 *
 * Every entry here is read through `import.meta.env` in shipped code, and every one is public:
 * Vite substitutes the literal value into the bundle at build time. Build-only variables that
 * `vite.config.ts` reads through `loadEnv` are deliberately absent. `.env.example` is the
 * inventory of all supported inputs.
 */
interface ImportMetaEnv {
  /** `legacy_session` or `keycloak_jwt`; anything else falls back to `legacy_session`. */
  readonly VITE_AUTHENTICATION_MODE?: string;
  /** Product API base. Blank keeps requests same-origin behind the proxy. */
  readonly VITE_API_BASE_URL?: string;
  /** Backend address shown in the UI. */
  readonly VITE_API_DISPLAY_URL?: string;
  /** Public Keycloak base URL. Required only in `keycloak_jwt` mode. */
  readonly VITE_KEYCLOAK_URL?: string;
  /** Public Keycloak realm. Required only in `keycloak_jwt` mode. */
  readonly VITE_KEYCLOAK_REALM?: string;
  /** Public Keycloak client id. Required only in `keycloak_jwt` mode. */
  readonly VITE_KEYCLOAK_CLIENT_ID?: string;
}

/** Bounded build revision injected by Vite; empty when the build did not supply one. */
declare const __APP_REVISION__: string;
