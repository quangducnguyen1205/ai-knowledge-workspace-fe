# AI Knowledge Workspace Frontend Demo

This repo is the separate frontend for the AI Knowledge Workspace demo. It is intentionally narrow, depends only on the Spring product API from Repo B, and does not call Repo A directly.

## Current Demo Scope

- workspace selection and creation
- workspace-scoped asset upload and listing
- processing status polling
- transcript retrieval
- explicit indexing
- search and transcript-context follow-up

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

Dockerized frontend build has also passed successfully.

## Environment Notes

- `.env.example` keeps the current demo defaults.
- Leave `VITE_API_BASE_URL` blank to use the Vite proxy path.
- In Docker dev, `docker-compose.yml` overrides `VITE_API_PROXY_TARGET` so the container can reach the host backend correctly.

## Intentional Non-Goals

- no auth, collaboration, chatbot/RAG, or routing-heavy redesign
- no media player or timestamp-seek UI
- no transcript timestamps invented on the frontend
- no heavy design system or production-grade docs set

## Optional Host-Node Path

If Node.js 18+ is installed locally later, the app can still be run with:

```bash
npm install
npm run dev
```
