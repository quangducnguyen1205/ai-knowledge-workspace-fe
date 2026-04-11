# Frontend Status

## Stack

- Vite
- React 18
- TypeScript
- TanStack Query
- Plain CSS
- Docker-first local dev via Vite in a container

## Implemented Demo Flow

- List and create workspaces
- Select visible workspace scope
- Upload one media asset into the selected workspace
- Poll asset processing status
- Fetch transcript rows when the asset is actually ready
- Trigger explicit indexing
- Search within the selected workspace
- Open separate transcript context for a chosen search hit

## Local Run Path

- Preferred local path: `docker compose up --build`
- Frontend is served from `http://localhost:5173`
- Vite runs inside Docker and proxies `/api` to the Spring backend on `http://host.docker.internal:8081`
- Source code is bind-mounted for normal local iteration

## Backend Mapping

- Frontend calls the Spring product API only
- Expected backend endpoints used by the demo:
  - `/api/workspaces`
  - `/api/assets`
  - `/api/assets/upload`
  - `/api/assets/{assetId}/status`
  - `/api/assets/{assetId}/transcript`
  - `/api/assets/{assetId}/index`
  - `/api/search`
  - `/api/assets/{assetId}/transcript/context`

## Intentionally Unfinished

- No auth or collaboration
- No media player or timestamp seek UX
- No routing beyond the single-shell demo
- No polished production UI or heavy design system
- No delete/edit asset management or advanced search filters

