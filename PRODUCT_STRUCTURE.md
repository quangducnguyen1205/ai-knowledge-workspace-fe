# Product Structure

## Screen model

Public entry is intentionally concise:

- Landing
- Login
- Register

The authenticated video knowledge workspace contains:

- Home for Add video/search actions and recent videos
- Library for video filtering, upload or YouTube URL entry, source display, rename, open, and delete
- Video for source-aware YouTube and Upload playback, transcript reading and explicit segment seek,
  transcript-local search, grounded questions, citations, and disclosed details
- Explore for grouped Workspace video moments and exact-row navigation
- Workspace tools for workspace management and account actions

## Routing choice

The app keeps its lightweight hash router so deployment behavior and existing deep links remain compatible.

Routes:

- `#/` — Landing when signed out, Home when authenticated
- `#/login`
- `#/register`
- `#/library`
- `#/library?upload=1` — controlled upload dialog
- `#/assets/:assetId` — Video viewer, including existing compact row/source/query focus state
- `#/search` — optional safe `q` query state remains supported
- `#/settings`

Authenticated access to Login or Register returns to Home. Signed-out protected deep links continue to show authentication without discarding the requested hash route, so the existing post-login hydration behavior remains intact.

## Navigation and responsive composition

Desktop primary navigation contains only Home, Library, and Explore. Workspace selection and
Add video remain global; identity, Workspace tools, and sign out live in the account menu.

The video viewer keeps its transcript-first desktop layout, adding one bounded source surface above the
transcript/assistant composition: a YouTube iframe for a `YOUTUBE` Asset, or a native video
element for an `UPLOAD` Asset served by the authorized Spring media endpoint. Exactly one
player renders per Asset. At mobile widths the player remains visible and inside the media
viewport while Transcript, Ask, and Details stay keyboard-operable tabs; playback never forces
a tab change or scrolls hidden transcript content. Where the authentication mode cannot carry
a native media request, the Upload surface shows bounded copy instead of a broken player. Add
video and workspace deletion use contained dialogs with Escape, focus trapping, and focus
restoration.

When a saved position exists for the open Asset, the viewer offers an explicit Continue watching
choice above the transcript instead of seeking on its own: resume from the saved timestamp, or
start from the beginning. Progress is saved quietly in the background and is never announced.

During playback, the timestamped active row is marked independently from a
search/citation-selected row. The transcript follows only while follow mode is enabled;
manual reading suspends it and a visible Resume following action restores alignment.

Workspace search presents Spring-ranked results as Asset groups. Group order follows each
Asset's first backend appearance, moment order stays unchanged inside a group, and the
frontend does not rerank by score or timestamp. Opening a moment reuses the existing Asset
route and stable transcript-row focus, without starting playback automatically. The scoped
query and results survive a safe return from the viewer; changing Workspace clears
incompatible results. The browser calls Spring only, never Elasticsearch or FastAPI.

## Preserved behavior

The refinement changes presentation and information hierarchy, not product contracts. Authentication, workspace provisioning and switching, upload validation, lifecycle polling, deep-link hydration, transcript display, both search scopes, assistant request safety, citation navigation, and deletion behavior continue through the existing feature hooks and Spring API modules.

Explicit indexing remains available only as recovery while a transcript is ready and automatic search preparation has not completed.

Saved moments and search-ranking redesign are not part of the current product structure.
