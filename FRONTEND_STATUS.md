# FRONTEND_STATUS

## 1. Purpose

This repo contains the separate demo-focused frontend for AI Knowledge Workspace. It provides a single-shell UI for the current Spring-owned product flow: workspace selection, asset upload, status polling, transcript retrieval, explicit indexing, search, and transcript-context follow-up. The frontend depends only on the Spring product API in Repo B and does not call Repo A directly.

## 2. Current Stack

- Vite
- React 18
- TypeScript
- TanStack Query for server state, polling, and cache invalidation
- Plain CSS with a single-shell demo layout
- Runtime approach: Vite dev server serving the frontend, with `/api` requests proxied to the Spring backend
- Docker/dev setup: Docker-first local development using `docker compose`, Vite running inside the container, repo bind-mounted for live iteration, and `host.docker.internal:8081` used as the backend target from inside Docker

## 3. Implemented Demo Flow

- Load workspaces from Spring and keep one visible workspace selected in the UI
- Create a workspace from the top bar and switch the demo scope to it
- Upload one media file into the selected workspace
- List workspace-scoped assets and select one asset for inspection
- Poll product-side asset status until the processing job becomes terminal
- Fetch transcript rows only when the asset is actually ready through Spring
- Show the selected asset lifecycle as a clearer current step plus next action
- Trigger transcript indexing as an explicit user action
- Keep search disabled until the active workspace has at least one SEARCHABLE asset
- Search within the selected workspace only
- Open a separate transcript-context view for a chosen search result
- Keep the shell focused on the golden path: workspace -> upload -> processing -> transcript -> index -> search -> context
- Reset search/context state when workspace selection changes, upload completes, indexing completes, or refreshed results no longer match the selected hit
- Keep indexing unavailable while assets are still processing, failed, or missing transcript rows
- Show friendlier demo-facing messages for transcript 409 states and upload validation rejections
- Current UI structure: top workspace bar plus three panels for assets, selected asset/transcript, and search/context

## 4. Backend API Surface Used

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/assets`
- `POST /api/assets/upload`
- `GET /api/assets/{assetId}/status`
- `GET /api/assets/{assetId}/transcript`
- `POST /api/assets/{assetId}/index`
- `GET /api/search`
- `GET /api/assets/{assetId}/transcript/context`

## 5. Local Run Path

- Recommended path: Docker
- Main commands:
  - `docker compose up --build`
  - `docker compose logs -f frontend`
  - `docker compose down`
- Expected frontend URL: `http://localhost:5173`
- Expected backend URL: `http://localhost:8081`
- Current Docker runtime behavior: the container runs the Vite dev server, exposes port `5173`, bind-mounts the source tree, keeps `node_modules` inside the container, and proxies `/api` requests to the host Spring backend

## 6. Manual Verification Notes

- Dockerized frontend build has passed successfully
- Dockerized local-dev startup has also been rechecked, with the Vite app serving on `http://localhost:5173`
- Happy-path search and transcript-context follow-up were manually verified in the browser
- Workspace switching and creation were manually verified
- Processing -> transcript_ready -> searchable flow was manually verified
- Failed asset flow was manually verified
- Invalid or rejected upload flow was manually verified
- Search empty state for nonsense queries was manually verified

## 7. Current Limitations / Intentionally Deferred

- No auth or collaboration
- No chatbot/RAG or assistant behavior
- No media player or timestamp seek UX
- No transcript timestamps invented on the frontend
- No routing beyond the current single-shell demo
- No heavy design system or production-polished UI
- No delete/edit asset management
- No advanced search filters beyond the current workspace-scoped query flow
- Conflict and validation handling is still intentionally lightweight and frontend-only

## 8. Quick Status Summary

- Separate frontend repo is scaffolded and running as a Vite + React + TypeScript demo app
- Current UI already covers workspace, upload, status, transcript, explicit indexing, search, and transcript context
- Selected asset lifecycle and next-step guidance are now clearer in the shell
- Search/context state is more tightly synced to workspace, upload, indexing, and refreshed results
- Demo-safety cleanup now prevents misleading indexing and uses clearer upload/transcript failure copy
- Docker-first local development is set up and is the recommended way to run the app
- The frontend currently depends only on the Spring product API surface
- Scope is still intentionally narrow, debuggable, and demo-friendly
