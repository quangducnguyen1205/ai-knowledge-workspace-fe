# FRONTEND_STATUS

## 1. Purpose

This repo now implements a small product-grade frontend for AI Knowledge Workspace before any future AI expansion. The frontend stays grounded in the real Spring-owned backend contract and focuses on the current authenticated product flow:

- auth
- workspace selection and management
- lecture video upload
- processing and transcript review
- explicit indexing
- workspace-scoped search
- asset-scoped search from Asset Detail
- search-to-asset study context
- transcript context around selected hits

It is intentionally not a chatbot surface, not a RAG shell, and not an AI assistant experience.

## 2. Current Stack

- Vite
- React 18
- TypeScript
- TanStack Query for server state, polling, and cache invalidation
- Plain CSS with a custom product shell and screen layouts
- Lightweight hash-based routing implemented locally in the app
- Docker-first local development with `/api` requests proxied to the Spring backend
- Responsive authenticated app shell with desktop top navigation and keyboard-operable compact mobile navigation

## 3. Current Product IA

The frontend now behaves like a routed web app with a persistent product shell instead of a single giant shell:

- Auth entry
- Workspace home
- Asset library
- Asset detail / transcript review
- Asset detail / transcript review / in-video search
- Workspace search
- Settings / workspace management

Authenticated routes are surfaced through top navigation on desktop: `Home`, `Library`, `Search`, and `Settings`. Upload is a single shell-level action into the existing Library upload flow rather than a fake standalone route. Asset Detail remains a deep Library route with a breadcrumb back to Library.

## 4. Frontend Modular Boundaries

The modularization approach is incremental and feature-first. It is not a framework migration or a full Feature-Sliced Design adoption.

- `app/` owns application startup, hash routing, authenticated shell composition, workspace bootstrap, and protected-route fallback.
- `features/` owns user-oriented flows such as auth, asset library/detail, workspace search, and Search-to-study route behavior.
- `entities/` owns reusable product-domain behavior shared by features, currently transcript display/reference handling.
- `lib/` owns shared API behavior, auth config, OIDC client setup, and generic UI primitives.

Dependency direction stays one-way: `app -> features/entities/lib`, `features -> entities/lib`, `entities -> lib`. Shared `lib` code must not depend on business features or entities. Router and bootstrap remain app-owned; Search route hydration remains Search-feature-owned; compact study route interpretation stays near the Search/study workflow; transcript display/reference behavior has one canonical transcript entity owner. The repo does not use barrel exports by default, so imports point to concrete module owners.

This refactor preserves existing routes, API request shapes, auth defaults, token handling, visible copy, and UX behavior.

## 5. Implemented Product Flow

- Sign in or create account through the authenticated product entry surface
- Resolve the signed-in user through `GET /api/me`
- Load the visible owned workspace scope
- Switch workspaces from the persistent app shell
- Create, rename, and conservatively delete workspaces through Settings
- Land in a workspace home screen with readiness summaries and next actions
- Open a dedicated asset library screen
- Upload lecture videos into the active workspace
- Review library-wide asset status in a full browse/manage screen
- Open a dedicated asset detail screen for transcript review
- Search within the currently viewed video from Asset Detail once that asset is searchable
- Rename and delete assets
- Poll processing state until terminal
- Load transcript rows only when the backend says they are ready
- Explicitly index transcript rows to unlock search
- Open a dedicated workspace search screen
- Search only within the active workspace
- Review ranked search results with a distinct asset title, transcript excerpt, and transcript moment metadata
- Open a result into the real Asset Detail route with the asset id, selected transcript-row reference, and optional source query preserved in the hash route
- Read nearby transcript rows from the existing transcript context API on Asset Detail
- Return to Search from a detail page that originated from a workspace result, preserving the safe query as `#/search?q=<query>` when available
- Optionally restrict search to the current asset from Asset Detail
- Open transcript context around a selected result
- Keep orientation through the top navigation active state, page heading, workspace status, visible account summary, and asset-detail breadcrumb

## 6. Backend API Surface Used

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `PATCH /api/workspaces/{workspaceId}`
- `DELETE /api/workspaces/{workspaceId}`
- `GET /api/assets`
- `POST /api/assets/upload`
- `PATCH /api/assets/{assetId}`
- `DELETE /api/assets/{assetId}`
- `GET /api/assets/{assetId}/status`
- `GET /api/assets/{assetId}/transcript`
- `POST /api/assets/{assetId}/index`
- `GET /api/search`
- `GET /api/assets/{assetId}/transcript/context`

## 7. Project 3 Auth Foundation

- Default mode remains `VITE_AUTHENTICATION_MODE=legacy_session`.
- Legacy mode keeps the existing register/login/logout/session-cookie behavior.
- Opt-in `VITE_AUTHENTICATION_MODE=keycloak_jwt` uses Keycloak Authorization Code + PKCE through the public `workspace-web` client.
- The JWT access token is held in memory and attached through the shared API client as `Authorization: Bearer <access-token>`.
- Temporary OIDC redirect transaction state may use session-scoped storage so a full-page Keycloak redirect can complete; authenticated tokens and product-user state are not persisted.
- Spring `GET /api/me` remains the visible product-user source after Keycloak redirects back.
- Workspace and asset authorization remains backend-controlled through Spring/PostgreSQL ownership; the frontend does not read Keycloak roles for product permissions.
- P3-C4 verified the local browser Keycloak flow: legacy auth remained visually available by default, opt-in JWT mode completed Authorization Code + PKCE through the public `workspace-web` client, Spring `/api/me` returned the local product user, the product shell rendered, browser storage inspection found no token persistence, and frontend logout cleared only local auth state.
- The P3-C4 smoke made one minimal frontend correction: redirect callback completion now shares the in-flight OIDC callback promise across React StrictMode effect replay so the development browser flow does not remain stuck on the callback loading state.
- Token refresh, silent SSO, global logout propagation, account management, production deployment cutover, auth-default cutover, and full accessibility certification remain future work.

## 8. Local Run Path

- Recommended path: Docker
- Main commands:
  - `docker compose up --build`
  - `docker compose logs -f frontend`
  - `docker compose down`
- Expected frontend URL: `http://localhost:5173`
- Expected backend URL: `http://localhost:8081`

## 9. Verification Notes

- Dockerized production build passed with `docker compose run --rm frontend npm run build`
- Auth boundary, workspace queries, asset queries, transcript flow, explicit indexing, and search remain backend-aligned
- The new routed shell compiles cleanly without adding external router dependencies
- P3-C4 local browser smoke passed for the opt-in Keycloak JWT flow. Evidence covered the legacy password auth entry, JWT Keycloak-only entry, empty Keycloak login form, authenticated product shell from Spring `/api/me`, local frontend logout return, and focused primary Keycloak action.
- P3-FE1 frontend tests cover the authenticated top navigation landmarks, `aria-current` active state, shell Upload action availability, and Escape-to-close behavior for the compact mobile menu.
- P3-FE1 browser checks are Vite-only by design. They do not claim authenticated backend/browser integration when Spring/auth services are not running.
- P3-FE2 component tests cover the Search page labelled query control, result readability, route/state produced by opening a result, loading/empty/error states, selected transcript context on Asset Detail, canonical transcript display without a selected row, missing-row feedback, Search return behavior, and keyboard activation for the context-opening action.
- P3-FE2 browser checks are public/auth-surface only when no real authenticated backend session is available; search and asset study behavior are validated through frontend component tests without fake backend sessions.
- P3-FE2.2 modularized app routing/bootstrap, Search route hydration, study route interpretation, and transcript display ownership without changing routes, API calls, auth defaults, or visible UX.

## 10. Design / Product Notes

- The UI now uses a persistent app shell with horizontal desktop navigation instead of a demo hero plus three fixed panels
- Routing is hash-based to stay compatible with the current frontend setup and avoid new backend/server route assumptions
- Upload copy and accepted file input remain lecture-video-first to match the current real product path
- Search stays disabled until explicit indexing produces searchable assets
- Workspace Search opens relevant results into Asset Detail so the learner can continue reading nearby transcript context without losing the source Search orientation
- Search return links carry only compact route state and reuse the existing product search path; result rows are not cached, fabricated, or serialized into the URL
- Asset Detail can reuse the same transcript-hit/context search pattern, but scoped to the current asset
- No assistant/chat UI, no fake AI affordances, and no unsupported media seek behavior were added
- P3-F1 assistant context remains a backend retrieval-only endpoint in this phase; no frontend answer generation, provider integration, or persisted chat state has been added.

## 11. Intentionally Deferred

- Chat or assistant flows
- Timestamp seek or media playback controls
- Collaboration features
- Cross-workspace asset movement
- Advanced search filters
- Analytics dashboards
- Broader auth-platform features beyond the current supported backend path

## 12. Quick Summary

- The frontend now feels like a small real product rather than a single-shell demo
- Navigation, layout hierarchy, empty states, and success/error handling are stronger and more realistic
- Workspace management is now a first-class settings workflow
- Asset review and search each have dedicated screens
- Scope remains tightly pre-AI and honest to the backend contract
