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

Transcript rows, search results, transcript-context rows, and assistant citations preserve
nullable `startMs`/`endMs` integer-millisecond metadata. Feature API adapters normalize legacy
payloads with missing timing fields to the single internal representation `null`; `0` remains a
valid value. Study renders an explicit seek action only when a usable media player is mounted
and the row has both timing bounds; the transcript passes exact milliseconds to a
provider-neutral player handle and does not import or manipulate `window.YT` or any
`HTMLMediaElement`.

`buildApiUrl` is the single API-base resolution used by both requests and the native Upload
media source, so an empty `VITE_API_BASE_URL` keeps media same-origin behind the deployment
proxy. `buildAssetMediaUrl` in the asset feature API is the only place the authorized
`GET /api/assets/{assetId}/media` path is constructed, and it derives that path from the
Asset id alone.

## Asset, upload, lifecycle, and search ownership

- `useAssetSelection` owns the workspace list query, deep-link/preferred selection reconciliation, selected ID refs, and selection continuity across list refreshes.
- `useAssetUpload` owns upload mutation state, workspace request mapping, list invalidation, scope reset, and a narrow post-success callback. `AssetUploadForm` owns only title/file validation and file-input reset behavior.
- `useAssetLifecycle` is the sole status/transcript polling owner. It keeps the existing 3,000 ms interval, polls only `PROCESSING` and `TRANSCRIPT_READY`, passes `AbortSignal` to status/transcript reads, refreshes list/search caches after automatic progress, stops at terminal/searchable status, and exposes semantic capability flags.
- `features/assets/player/media-player.ts` owns the provider-neutral contract shared by every adapter: `MediaPlayerHandle`, `MediaPlaybackState`, `MediaPlaybackSnapshot`, and the documented floor-to-milliseconds position rule. It contains no provider constant and no media-element detail.
- `features/assets/player/youtube-player.tsx` owns the retryable singleton official YouTube IFrame API loader, privacy-enhanced player construction, provider state numbers, visibility-aware 250 ms position sampling, bounded readiness/error cleanup, and one latest pending seek command.
- `features/assets/player/upload-media-player.tsx` owns native HTML `<video>` playback of the authorized Spring media endpoint, the browser-event to neutral-state mapping, event-driven position observation with no polling loop, bounded loading/error/unsupported-auth presentation, and the same latest-pending-command policy. It also owns the native-media authentication capability check: Upload playback is offered in `legacy_session` mode only, because a media element cannot attach an in-memory bearer token.
- Study mounts exactly one adapter per Asset, selected by `resolveMediaPlaybackAvailability`. Ephemeral playback state (active row, follow mode, pending command) stays local and never enters React Query. HTTP Range handling is delegated to the browser and Spring, and no media bytes are buffered, cached, or assembled in the browser.
- `features/assets/hooks/use-asset-playback-progress.ts` owns the Spring playback-progress read, the bounded five-second save policy, immediate pause/end/seek saves, completion transitions, duplicate suppression, per-Asset tracking reset and the best-effort final save. `shouldTrackPlaybackPosition` keeps provider lifecycle, cueing and teardown snapshots from replacing the position a final save persists, so switching directly between Assets cannot overwrite real progress with a reset `0`. It uses its own `assetKeys.playbackProgress` key, never invalidates Asset, transcript or search queries, and stamps every write with the Asset id it was recorded for so a late save cannot target another Asset. `AssetDetailScreen` stays query-free and receives the loaded progress plus a neutral snapshot callback as props.
- `entities/transcript/model/active-transcript-row.ts` owns provider-neutral active-row identity and inclusive-start/exclusive-end resolution. `AssetDetailScreen` connects neutral snapshots to row identity and one explicit follow mode; transcript presentation owns active/focused markers, user suspension and bounded viewport scrolling. YouTube and Upload share this single implementation; there is no source-specific resolver or follow mode.
- `AssetIndexingRecoveryAction` renders explicit indexing only from lifecycle-derived recovery state. It retains the secondary button, current recovery explanation, existing POST endpoint, mutation errors, and post-success list/search refresh.
- `useAssetManagement` owns rename/delete mutation state, cache reconciliation, success notices, and stale 404 cleanup. `AssetList`, `SelectedAssetPanel`, `AssetLifecyclePanel`, and `SelectedAssetTranscriptPanel` own their focused presentation boundaries.
- `useSearchController` owns submitted query, workspace/optional-asset scope, abortable search/context queries, selected result, stale-result cleanup, and reset rules. Search presentation does not own assistant answers.
- Workspace moment grouping is frontend presentation logic: it preserves the first backend
  appearance of each Asset and relative moment order inside that Asset, so grouping never
  changes Spring relevance or reranks by score or timestamp.
- Exact-moment opening reuses the existing compact Asset/row route. Search state remains scoped
  by Workspace and normalized query in React Query; scope changes reset incompatible visible
  state, and aborted or old-key responses cannot replace current results.
- `useWorkspaceManagement` now owns workspace mutation notices and 404 reconciliation; bootstrap selection remains isolated in `useWorkspaceBootstrap`.

Spring remains the only browser-facing product API for search, transcript context,
authorization, and Asset data. The frontend does not call Elasticsearch or FastAPI directly.
Saved moments and search-ranking redesign are intentionally outside this boundary.

Static assertions protect the neutral HTTP direction, shell/API separation, lifecycle/assistant separation, upload/polling separation, infrastructure URL ban, the provider-neutral player contract, Upload media URL ownership inside the asset feature API, media-element details staying inside the Upload adapter, and absence of circular production imports.

## Assistant and citation ownership

- `useAssetAssistant` exclusively owns question/validation state, the abortable Spring request, request identity checks, loading/error/unavailable/insufficient/success states, scope reset, and resubmission with the retained question after an error. It has no routing, DOM lookup, lifecycle, upload, or citation-rendering responsibility.
- `AssetAssistantPanel` owns form association, disabled/loading semantics, live status announcements, and composition of the hook state. `AssistantAnswerPanel` owns answer versus insufficient-context presentation.
- `AssistantCitationList` and `AssistantCitationItem` preserve the citation sequence already validated and de-duplicated by Spring, source IDs, segment compatibility references, invalid-reference fallback, accessible action names, and existing CSS/DOM meaning. They perform no API request.
- `useAssistantCitationNavigation` is the only citation-to-source route owner. It validates the transcript/segment reference, clears the asset-search selection, preserves selected-asset continuity, and writes the existing `#/assets/:id?row=...&from=assistant` route.

The import assertions additionally prevent assistant orchestration from importing answer/citation presentation and prevent citation presentation/navigation from making requests.

## Compatibility and remaining work in this phase

The baseline exposes no separate direct-upload browser endpoint; the retained upload contract is Spring `POST /api/assets/upload`. Explicit indexing remains available in `TRANSCRIPT_READY` as recovery. `AppRouter` now coordinates only app-wide auth/bootstrap/cache reconciliation and explicit cross-feature route seams; it does not call upload, lifecycle, indexing, search, or assistant APIs. Remaining debt is the broad prop surface of `AssetDetailScreen` and the legacy combined workspace UI/query module. Those can be reduced later without changing the frozen route or product contracts.
