# AI Knowledge Workspace Frontend Demo

This repo is the separate frontend for the AI Knowledge Workspace demo. It is intentionally narrow, depends only on the Spring product API from Repo B, and does not call Repo A directly.

## Current Demo Scope

- workspace selection and creation
- workspace-scoped asset upload and listing
- processing status polling
- transcript retrieval
- explicit indexing
- workspace search with result-to-asset study context
- transcript-context follow-up around selected hits
- search within the currently viewed video from Asset Detail
- selected asset lifecycle guidance with a clearer current step and next action
- search disabled until the active workspace has at least one searchable asset
- search/context state kept in sync across workspace switch, upload completion, indexing completion, and refreshed results
- responsive product app shell with persistent desktop top navigation and compact mobile navigation

## Navigation Model

Authenticated product screens use a horizontal top navigation model:

- `Home` for workspace readiness and next action orientation
- `Library` for upload, asset inventory, and asset management
- `Search` for workspace-scoped transcript search and opening relevant asset moments
- `Settings` for workspace management and account context

Asset detail remains a deep route under Library and exposes a breadcrumb back to the library. The shell includes a skip-to-content link, active navigation state with `aria-current`, a keyboard-operable compact mobile menu, and a single shell-level Upload action that routes to the existing Library upload flow. P3-F1 assistant context remains a backend retrieval-only API; this frontend phase does not add assistant answers, chat state, or fake AI output.

## Search And Study Flow

Workspace Search now supports the real learner flow:

```text
Search transcript text
-> review ranked results with asset title, excerpt, and transcript moment metadata
-> Study this moment
-> Asset Detail opens with the selected transcript row carried in the hash route
-> nearby transcript context loads from the existing transcript context API
-> the canonical transcript remains available below, with the selected row marked when visible
```

The route carries only compact state: asset id, transcript-row reference, and optional source query. It does not serialize transcript text, credentials, raw API payloads, user email, tokens, or private data into the URL. Asset Detail keeps a return action back to Search when the route originated there, while Library remains the canonical place for upload and asset management.

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
- P3-C4 local Keycloak browser smoke: legacy auth entry remained visually available, and opt-in `keycloak_jwt` completed browser Authorization Code + PKCE through Keycloak, returned to the frontend, called Spring `/api/me`, rendered the authenticated product shell, and returned to the local Keycloak entry surface after frontend logout
- P3-FE1 product shell foundation: route-aware top navigation, mobile menu Escape handling, skip link, active destination state, and visible account/workspace context are covered by frontend tests. Browser verification for this phase is Vite-only and does not claim authenticated backend integration when Spring/auth runtime is not running.

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
- no collaboration, chatbot/RAG, assistant answer UI, or generated answer placeholder
- no media player or timestamp-seek UI
- no transcript timestamps invented on the frontend
- no heavy design system or production-grade docs set

## Optional Host-Node Path

If Node.js 18+ is installed locally later, the app can still be run with:

```bash
npm install
npm run dev
```
