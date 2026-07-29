# AI Knowledge Workspace Frontend

This repo is the separate frontend for the AI Knowledge Workspace product. It is intentionally
narrow, depends only on the Spring product API, and does not call the internal FastAPI service
directly. See the [Project3 v1 final baseline](https://github.com/quangducnguyen1205/ai-knowledge-workspace/blob/project3-submission-v1/docs/submission/project3-final-baseline.md)
for cross-repository ownership and evidence.

## Current Product Scope

- concise public landing page plus dedicated Login and Register routes
- workspace selection and creation
- workspace-scoped `Add video` entry for either a validated upload file or a public YouTube URL
- source-aware library/detail presentation and authorized failed-processing retry
- privacy-conscious YouTube playback in Study with explicit transcript segment seek controls
- processing status polling
- transcript retrieval
- automatic indexing as the normal lifecycle, with explicit indexing retained as a fallback
- Workspace Search with result-to-video study context
- Find in transcript on the current Study screen
- desktop transcript/assistant study layout with deliberate Transcript, Ask, and Details mobile views
- search/context state kept in sync across workspace switch, upload completion, indexing completion, and refreshed results
- responsive product shell with Home, Library, and Search primary navigation
- workspace selector, Add video action, and compact account menu with Settings and sign out
- grounded Ask-this-video answers with insufficient-context handling, actionable citations, and transcript navigation
- incremental frontend module boundaries documented in `FRONTEND_STATUS.md`

## Navigation Model

Signed-out routes use the existing hash deployment model:

- `#/` for the landing page
- `#/login` for Login
- `#/register` for Register

Authenticated product screens use a compact top navigation model:

- `Home` for immediate actions and recent learning
- `Library` for upload, filtering, and video management
- `Search` for workspace-wide transcript search and opening relevant moments

Settings remains available from the account menu at `#/settings`. Study remains a compatible deep route at `#/assets/:assetId`, with existing compact query state for search and citation focus. The shell includes a skip-to-content link, active state with `aria-current`, keyboard-operable mobile and account menus, and a shell-level Add video action that opens `#/library?upload=1`. The Add video dialog explicitly selects `Upload file` or `YouTube URL`; source forms stay separate, preserve upload validation, and prevent stale or duplicate submission.

## Source Entry And Ownership

Upload creation remains multipart through `POST /api/assets/upload`. YouTube creation uses a
separate JSON request to `POST /api/assets/youtube` with the current workspace, URL, and
optional title. Spring remains the normalization, duplicate-detection, authorization, and
canonical source-URL authority. The browser does not parse persisted YouTube identity, fetch
YouTube metadata, or call FastAPI directly.

Both sources enter the existing Asset lifecycle. The frontend preserves Spring-returned
`sourceType`, nullable `youtubeVideoId`, canonical `sourceUrl`, and safe processing failure
codes. Upload-only filename, content type, and size fields are rendered only when applicable.
Internal FastAPI V2 performs temporary YouTube acquisition as part of processing; that
internal boundary is not browser-accessible.

## Source-Aware Study Playback

Study mounts exactly one media adapter per Asset. Both adapters implement the same
provider-neutral contract in `features/assets/player/media-player.ts`: millisecond seek,
play, and `{ state, positionMs }` playback snapshots. Provider constants stay in the YouTube
adapter and media-element details stay in the Upload adapter, so transcript synchronization
and Study orchestration consume neutral snapshots only.

## YouTube Player And Transcript Seek

Study renders the official YouTube IFrame Player API only when the authoritative Asset
source is `YOUTUBE` and Spring supplies `youtubeVideoId`. A small feature-owned adapter
loads the API script once, uses the privacy-enhanced `youtube-nocookie.com` host, owns
player readiness/error/destruction, and exposes only millisecond seek and play behavior to
Study. It never parses `sourceUrl` to recover provider identity.

Transcript rows with both `startMs` and `endMs` expose an explicit, keyboard-operable
`Play transcript segment from …` control. Activation seeks to the exact `startMs` and
starts playback; conversion from milliseconds to YouTube seconds occurs only inside the
adapter. If the player is not ready, only the latest pending seek is applied once on
readiness.

## Upload Playback Through Spring

An `UPLOAD` Asset plays through a native HTML `<video>` element whose source is the
authorized Spring endpoint `GET /api/assets/{assetId}/media`. The URL is derived from the
Asset id alone using the same API-base convention as every other product request, so a blank
`VITE_API_BASE_URL` keeps media same-origin behind the deployment proxy. The browser never
learns a bucket, object key, storage host, or upload filename, never calls MinIO or FastAPI,
and never reconstructs a storage path from upload metadata.

The element uses native controls, `preload="metadata"`, `playsInline`, and no autoplay. HTTP
Range handling is delegated entirely to the browser and Spring: the frontend never fetches
media as a Blob, never creates an object URL from a full response, never concatenates ranges
manually, and never caches media bytes in state or IndexedDB. No `crossOrigin` attribute is
set, because the supported topology is same-origin. Actual browser Range behavior is
verified separately in Slice 4C.

Upload media renders independently of transcript readiness, including while the Asset is
`PROCESSING` or `FAILED`. Browser media events (`loadstart`, `loadedmetadata`, `canplay`,
`playing`, `pause`, `waiting`, `stalled`, `seeking`, `seeked`, `timeupdate`, `ended`,
`error`) are mapped deterministically to the neutral playback model inside the adapter and
never leave it; there is no polling loop for Upload. `currentTime` seconds are floored to
integer milliseconds by the same shared rule the YouTube adapter uses, and non-finite or
negative positions become `null`. Redundant snapshots are suppressed when state and position
are unchanged.

A rejected or unavailable `HTMLMediaElement.play()` promise becomes bounded, non-fatal
interaction feedback rather than an uncaught rejection or raw browser text. A media error
shows bounded copy, clears playback-active state, and stops synchronization while leaving
the transcript, search, assistant, retry, and details surfaces intact. Raw media error codes,
HTTP bodies, and storage errors are never rendered.

### Authentication Delivery Boundary

A native `<video src="…">` request cannot attach an in-memory bearer token. Upload playback
is therefore offered only in `legacy_session` mode, where the request carries the same
authenticated session credential the rest of the product already uses. In `keycloak_jwt`
mode the frontend renders bounded copy — `Upload playback is not available in this
authentication mode yet.` — and creates no media element and no misleading seek actions. It
does not buffer the file as a Blob, put a token in the URL or a query parameter, expose a
presigned storage URL, or add a service worker or MediaSource implementation. Native-media
delivery for bearer mode is a deferred, separately designed boundary.

The browser continues to use Spring for product data and connects to YouTube only for the
official iframe player. It never calls FastAPI. This repository currently sets no
production Content Security Policy; a deployment CSP must intentionally allow the official
YouTube API script and `youtube-nocookie.com` frame host without broadly weakening other
directives.

While a ready player is playing or buffering, the adapter samples provider position every
250 milliseconds only while the document is visible. It stops immediately for pause, end,
error, video change, hidden documents, and unmount; visibility restoration performs one
immediate read before resuming. Provider seconds are floored to integer milliseconds at the
adapter boundary. Playback position remains ephemeral and is never stored in React Query or
sent to Spring.

The provider-neutral transcript resolver activates only timestamped rows satisfying
`startMs <= positionMs < endMs`. Gaps and missing timing produce no active row; overlaps use
greatest eligible start, then lowest segment index, then stable input order. Playback-active
and search/citation-focused markers are separate and may coexist.

Transcript auto-follow begins enabled, scrolls only when the active row is near or outside
the dedicated transcript viewport, and respects reduced-motion preferences. Wheel, touch,
keyboard scrolling, scrollbar interaction, text selection, and search/citation navigation
suspend following. `Resume following` or an explicit Play segment action restores it without
moving focus as playback advances. The paused-follow live status text is separate from the
`Resume following` control so the status region stays non-interactive. Player errors stop
observation and clear playback-active state while preserving transcript reading and, for
YouTube, the external fallback.

Upload and YouTube share this synchronization entirely. There is no Upload-specific active
row resolver, follow mode, or presentation, and playback position is never stored in React
Query or sent to Spring. Watch progress is not persisted.

## Asset Processing And Indexing Lifecycle

The frontend remains processing-mode agnostic. It polls Spring while an asset is `PROCESSING` or `TRANSCRIPT_READY`, stops when the backend reports `SEARCHABLE` or `FAILED`, and refreshes workspace/search state when the lifecycle advances. A failed upload or YouTube Asset exposes the authorized `POST /api/assets/{assetId}/retry-processing` action; a successful `202` moves the same Asset back to `PROCESSING` and resumes the existing polling loop. In the normal integrated path, indexing follows transcript readiness automatically. The `Index transcript` control remains available only in `TRANSCRIPT_READY` as an explicit fallback when automatic completion has not advanced the asset; it is not required after a normal transition to `SEARCHABLE`.

The frontend tests, typecheck and production build are green. The bounded B4 browser
validation also passed upload through automatic indexing, SEARCHABLE, search, grounded
assistant answer, citation navigation and desktop/mobile checks. This does not claim
production-scale capacity, security certification or unrestricted chatbot behavior.

## Search And Study Flow

Workspace Search now supports the real learner flow:

```text
Search workspace
-> review ranked results with asset title, excerpt, and transcript moment metadata
-> Open in video
-> Study opens with the selected transcript row carried in the hash route
-> nearby transcript context loads from the existing transcript context API
-> the transcript remains available with the selected moment marked when visible
```

The route carries only compact state: asset id, transcript-row reference, and optional source query. It does not serialize transcript text, credentials, raw API payloads, user email, tokens, or private data into the URL. Study keeps a return action back to Search when the route originated there, including the safe original query as `#/search?q=<query>` when present. Returning to Search reloads results through the existing product search API; result rows are not cached, fabricated, or serialized into the URL. Library remains the canonical place for upload and video management.

## Local Setup

Preferred path: Docker-first local development

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Expected backend: `http://localhost:8081`

This runs the Vite dev server inside Docker, bind-mounts the repo for local iteration, and proxies `/api` requests from the container to the host Spring backend through `http://host.docker.internal:8081`.

## Manual Verification Notes

Recently verified in the browser:

- workspace switching and workspace creation flow
- processing -> transcript_ready -> searchable happy path
- search results and transcript-context follow-up
- failed asset flow
- invalid or rejected upload flow
- empty search results for nonsense queries
- automatic Project3 lifecycle through SEARCHABLE, search, grounded assistant answer and
  citation navigation without a direct browser request to FastAPI
- P3-C4 local Keycloak browser smoke: legacy auth entry remained visually available, and opt-in `keycloak_jwt` completed browser Authorization Code + PKCE through Keycloak, returned to the frontend, called Spring `/api/me`, rendered the authenticated product shell, and returned to the local Keycloak entry surface after frontend logout
- Product shell behavior: three-item route-aware navigation, mobile and account-menu Escape handling, skip link, active destination state, and the compact workspace selector are covered by frontend tests.

Dockerized frontend build has also passed successfully, and the Docker local-dev path has recently been rechecked with the app serving on `http://localhost:5173`.

## Environment Notes

- `.env.example` keeps the current demo defaults.
- `VITE_AUTHENTICATION_MODE=legacy_session` is the default and preserves the existing Spring register/login/session flow.
- `VITE_AUTHENTICATION_MODE=keycloak_jwt` opts the frontend into the Project 3 Keycloak foundation. It uses Authorization Code + PKCE with the public `workspace-web` client, holds the access token in memory only, and sends product API calls as `Authorization: Bearer <access-token>`.
- The OIDC redirect transaction may use session-scoped browser storage for temporary state/PKCE callback data. Authenticated token and product-user state remain memory-only.
- In `keycloak_jwt` mode, Spring `GET /api/me` remains the product-user authority. The frontend does not authorize workspace or asset access from Keycloak roles or raw JWT claims.
- Frontend logout in `keycloak_jwt` mode clears local in-memory auth state only. It does not claim global Keycloak logout.
- Local Keycloak public-client settings are `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, and `VITE_KEYCLOAK_CLIENT_ID`. They are not required in the default legacy mode and must not include client secrets, admin credentials, tokens, or user credentials.
- Leave `VITE_API_BASE_URL` blank to use the Vite proxy path.
- In Docker dev, `docker-compose.yml` overrides `VITE_API_PROXY_TARGET` so the container can reach the host backend correctly.

## Intentional Non-Goals

- no production Keycloak deployment or auth-default cutover claimed
- no token refresh, silent SSO, global Keycloak logout propagation, account-management wiring, or production deployment cutover yet
- no full accessibility certification; P3-C4 was a targeted local browser smoke with keyboard/focus/error-state checks
- no collaboration, chat history, provider/model controls, browser-to-FastAPI calls, or
  browser provider access beyond the official YouTube iframe
- no Upload playback in `keycloak_jwt` mode, because no native-media credential path exists
  for a bearer token yet
- no full-file Blob buffering, object URLs, manual Range handling, media caching, service
  worker, or MediaSource implementation for Upload playback
- no persisted watch progress
- no production CDN or dedicated media-delivery design
- no synchronization telemetry or drift correction beyond deterministic provider-position
  sampling, and no timeline state, playlist/channel ingestion, or source metadata editing
- no transcript timestamps invented on the frontend
- no heavy design system or production-grade docs set

Static Slice 4B does not mark all of Phase 4 complete. Browser/runtime Upload playback
acceptance is Slice 4C, and browser/runtime YouTube player acceptance, production CSP
hardening, and bearer-mode native-media delivery remain separate work.

## Optional Host-Node Path

If Node.js 18+ is installed locally later, the app can still be run with:

```bash
npm install
npm run dev
```
