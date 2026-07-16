# AI Knowledge Workspace Frontend

This repo is the separate frontend for the AI Knowledge Workspace product. It is intentionally
narrow, depends only on the Spring product API, and does not call the internal FastAPI service
directly. See the [Project3 v1 final baseline](https://github.com/quangducnguyen1205/ai-knowledge-workspace/blob/project3-submission-v1/docs/submission/project3-final-baseline.md)
for cross-repository ownership and evidence.

## Current Product Scope

- concise public landing page plus dedicated Login and Register routes
- workspace selection and creation
- workspace-scoped video upload in a controlled dialog and focused library management
- processing status polling
- transcript retrieval
- automatic indexing as the normal lifecycle, with explicit indexing retained as a fallback
- Workspace Search with result-to-video study context
- Find in transcript on the current Study screen
- desktop transcript/assistant study layout with deliberate Transcript, Ask, and Details mobile views
- search/context state kept in sync across workspace switch, upload completion, indexing completion, and refreshed results
- responsive product shell with Home, Library, and Search primary navigation
- workspace selector, Upload action, and compact account menu with Settings and sign out
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

Settings remains available from the account menu at `#/settings`. Study remains a compatible deep route at `#/assets/:assetId`, with existing compact query state for search and citation focus. The shell includes a skip-to-content link, active state with `aria-current`, keyboard-operable mobile and account menus, and a shell-level Upload action that opens `#/library?upload=1`. The upload dialog, workspace deletion dialog, and mobile Study views preserve focus, Escape, and duplicate-submit protections.

## Asset Processing And Indexing Lifecycle

The frontend remains processing-mode agnostic. It polls Spring while an asset is `PROCESSING` or `TRANSCRIPT_READY`, stops when the backend reports `SEARCHABLE` or `FAILED`, and refreshes workspace/search state when the lifecycle advances. In the normal integrated path, indexing follows transcript readiness automatically. The `Index transcript` control remains available only in `TRANSCRIPT_READY` as an explicit fallback when automatic completion has not advanced the asset; it is not required after a normal transition to `SEARCHABLE`.

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
- no collaboration, chat history, provider/model controls, or browser-to-provider access
- no media player or timestamp-seek UI
- no transcript timestamps invented on the frontend
- no heavy design system or production-grade docs set

## Optional Host-Node Path

If Node.js 18+ is installed locally later, the app can still be run with:

```bash
npm install
npm run dev
```
