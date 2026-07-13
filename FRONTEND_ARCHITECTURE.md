# Frontend Architecture Boundaries

## Scope

This note records the P3-S5.B4 behavior-preserving decomposition. The browser continues to call only the Spring `/api/...` surface. Hash routes, authentication modes, API contracts, lifecycle timing, labels, and CSS remain unchanged.

## Baseline ownership map

The baseline was `0c4797436c9e7106146388a09322e2d32782fceb`. `AppShell.tsx` was 1,421 lines, `features/assets/assets.tsx` was 1,142 lines, and `lib/api.ts` was 479 lines.

### AppShell state, effects, and callbacks before extraction

| Classification | Baseline owner and state/callback | Purpose and dependencies | Trigger and cleanup | Existing protection | Target owner |
| --- | --- | --- | --- | --- | --- |
| ROUTING | `route`, `navigate`, routed asset effect | Parse hash, synchronize deep-linked asset, redirect missing asset | `hashchange`; listener cleanup in `useHashRoute` | route and Search route-flow tests | `AppRouter` and route model |
| GLOBAL_LAYOUT | `isMobileNavOpen`, menu ref, page metadata, nav items | Header, active nav, breadcrumb, compact menu focus | route change and Escape; keydown cleanup | auth shell and `AppShell.test.tsx` | `AppShell` |
| AUTH_SESSION | current-user query and auth-mode derivation | Resolve legacy/JWT authenticated states | token/config/current-user changes | auth-flow tests | auth boundary plus app composition |
| AUTH_SESSION | register/login/logout mutations and reset/reconcile callbacks | Preserve legacy login, local JWT logout, query cleanup | submit/logout success | auth-flow and HTTP tests | auth application boundary |
| WORKSPACE_SELECTION | workspace queries/mutations, selected/preferred IDs, notices | Bootstrap persisted selection and manage workspace scope | user/session/workspace responses; local-storage failure ignored | bootstrap/fallback and auth tests | workspace application boundary |
| WORKSPACE_SELECTION | `clearWorkspaceScopedState`, create/select/rename/delete handlers | Reconcile deleted or changed scope and cache | workspace actions, 404 recovery | existing integration behavior | workspace application boundary |
| ASSET_LIST_QUERY | assets query and derived counts | Supply library/home/search/header inventory | selected workspace | Search route-flow tests | asset selection/query boundary |
| ASSET_SELECTION | selected/preferred IDs and refs, `openAsset` | Preserve selection across list refresh and deep links | workspace/assets/route changes | Search route-flow tests | asset selection boundary |
| ASSET_LIFECYCLE_REFRESH | polling flag, status/transcript queries, resolved status, invalidation effects | Poll at 3 seconds through `PROCESSING` and `TRANSCRIPT_READY`; refresh automatic indexing | selected asset/status/transcript; React Query interval cleanup | lifecycle characterization | `useAssetLifecycle` |
| ASSET_UPLOAD | upload mutation/reset/effect and `handleUpload` | Submit workspace file, select returned asset, navigate and refresh list | form submit/success/workspace change | upload/API characterization | `useAssetUpload` and upload form |
| EXPLICIT_INDEXING_RECOVERY | index mutation/reset/effect and `handleIndexAsset` | Secondary recovery action and list/search refresh | explicit click/success/asset change | lifecycle characterization | recovery hook/component |
| ASSET_DETAILS | rename/delete mutations, notices, cache rewrite callbacks | Manage selected asset and stale 404 state | explicit actions | Search workflow and UI behavior | focused asset management hooks |
| SEARCH_QUERY | workspace submitted query/result/reset state and route hydration | Keep workspace query, result and return route continuity | workspace/route/results changes | Search workflow/route tests | workspace search controller |
| SEARCH_QUERY | asset submitted query/result/reset state | Scope search to current asset | asset/workspace/results changes | Search workflow tests | asset search controller |
| CITATION_NAVIGATION | `openAssistantCitationInAsset` | Validate row reference, select asset and write compact route | citation click | route/Search workflow tests | assistant citation navigation owner |
| PRESENTATIONAL_UI | route switch and large prop chains | Compose home/library/detail/search/settings screens | route/context changes | integration tests | `AppRouter` plus route feature containers |

### Asset module before extraction

| Classification | Baseline responsibility | API calls and dependencies | Cleanup/cancellation | Tests | Target owner |
| --- | --- | --- | --- | --- | --- |
| FEATURE_API | asset keys and five query/mutation wrappers | list/status/transcript/index/delete/rename/upload | React Query ownership | HTTP tests | feature query hooks and APIs |
| ASSET_UPLOAD | title/file/ref, submit and success reset | multipart upload through Spring | input reset on success | upload characterization | upload feature |
| ASSET_LIST_QUERY | list, status legend, selection and delete rows | asset summaries | none | Search route flow | asset list component |
| ASSET_LIFECYCLE_REFRESH | terminal/poll/status derivation and lifecycle copy | asset/status/transcript/index responses | interval owned by caller | lifecycle characterization | lifecycle model and hook |
| EXPLICIT_INDEXING_RECOVERY | index availability derivation and action card | transcript/status/index mutation | mutation reset on asset change | lifecycle characterization | recovery component |
| ASSET_DETAILS | rename form and technical/friendly error mapping | PATCH asset | draft reset on asset change | workflow behavior | asset details component |
| PRESENTATIONAL_UI | details, lifecycle rail and transcript list | transcript display entity | none | Search workflow | focused components |

### API ownership before extraction

| Classification | Baseline owner | Responsibility | Target owner |
| --- | --- | --- | --- |
| SHARED_HTTP | `lib/api.ts` | base URL, cookies/bearer, JSON/multipart mechanics, response parsing, auth errors | `shared/api/http-client.ts`, `api-error.ts` |
| FEATURE_API | `lib/api.ts` | auth/session endpoints and DTOs | `features/auth/api` |
| FEATURE_API | `lib/api.ts` | workspace endpoints and DTOs | `features/workspaces/api` |
| FEATURE_API | `lib/api.ts` | asset list/detail/lifecycle/index endpoints and DTOs | `features/assets/api` and model |
| FEATURE_API | `lib/api.ts` | multipart upload | `features/upload/api` |
| FEATURE_API | `lib/api.ts` | search and transcript context | `features/search/api` and transcript entity types |
| FEATURE_API | `lib/api.ts` | assistant answer | `features/assistant/api` |

## Current application boundary

- `main.tsx` mounts `AppProviders` and `App`.
- `AppProviders` owns the TanStack Query client and authentication provider composition.
- `AppRouter` owns hash-route composition and currently coordinates the remaining route feature seams.
- `AppShell` owns only global layout/navigation behavior and renders route content through `children`; it imports no asset, upload, search, or assistant API.

## Shared HTTP and feature APIs

`shared/api/http-client.ts` is the only request boundary. It preserves Spring base URL resolution, proxy behavior, cookie credentials, in-memory bearer headers, JSON/multipart handling, `AbortSignal`, error parsing, and JWT boundary callbacks. Endpoint paths and DTOs live with auth, workspaces, assets, upload, search, and assistant features. Shared HTTP never imports a product feature.

## Compatibility and remaining work in this phase

The baseline exposes no separate direct-upload browser endpoint; the retained upload contract is Spring `POST /api/assets/upload`. Explicit indexing remains available in `TRANSCRIPT_READY` as recovery. The next two commits move upload/lifecycle/asset/search and assistant/citation ownership out of `AppRouter` and the concentrated feature modules.
