# AI Knowledge Workspace Frontend Demo

This repo contains a narrow React frontend for the current Spring Boot product flow:

- workspace selection and creation
- workspace-scoped asset upload and listing
- processing status polling
- transcript retrieval
- explicit indexing
- search and transcript-context follow-up

## Local Setup

Preferred path:

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Expected backend: `http://localhost:8081`

This runs the Vite dev server inside Docker, bind-mounts the repo for local iteration, and proxies `/api` requests from the container to the host Spring backend through `http://host.docker.internal:8081`.

## Environment Notes

- `.env.example` keeps the current demo defaults.
- Leave `VITE_API_BASE_URL` blank to use the Vite proxy path.
- In Docker dev, `docker-compose.yml` overrides `VITE_API_PROXY_TARGET` so the container can reach the host backend correctly.

## Optional Host-Node Path

If Node.js 18+ is installed locally later, the app can still be run with:

```bash
npm install
npm run dev
```
