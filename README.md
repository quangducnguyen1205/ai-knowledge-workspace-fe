# AI Knowledge Workspace Frontend Demo

This repo is the separate frontend for the AI Knowledge Workspace demo. It is intentionally narrow, depends only on the Spring product API from Repo B, and does not call Repo A directly.

## Current Demo Scope

- workspace selection and creation
- workspace-scoped asset upload and listing
- processing status polling
- transcript retrieval
- explicit indexing
- search and transcript-context follow-up
- search within the currently viewed video from Asset Detail
- selected asset lifecycle guidance with a clearer current step and next action
- search disabled until the active workspace has at least one searchable asset
- search/context state kept in sync across workspace switch, upload completion, indexing completion, and refreshed results

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
- no collaboration, chatbot/RAG, or routing-heavy redesign
- no media player or timestamp-seek UI
- no transcript timestamps invented on the frontend
- no heavy design system or production-grade docs set

## Optional Host-Node Path

If Node.js 18+ is installed locally later, the app can still be run with:

```bash
npm install
npm run dev
```
