# Product Structure

## Screen model

Public entry is intentionally concise:

- Landing
- Login
- Register

The authenticated learning workspace contains:

- Home for upload/search actions and recent learning
- Library for video filtering, upload, rename, open, and delete
- Study for transcript reading, transcript-local search, grounded questions, citations, and disclosed details
- Workspace Search for cross-video results and direct Study navigation
- Settings for workspace management and account actions

## Routing choice

The app keeps its lightweight hash router so deployment behavior and existing deep links remain compatible.

Routes:

- `#/` — Landing when signed out, Home when authenticated
- `#/login`
- `#/register`
- `#/library`
- `#/library?upload=1` — controlled upload dialog
- `#/assets/:assetId` — Study, including existing compact row/source/query focus state
- `#/search` — optional safe `q` query state remains supported
- `#/settings`

Authenticated access to Login or Register returns to Home. Signed-out protected deep links continue to show authentication without discarding the requested hash route, so the existing post-login hydration behavior remains intact.

## Navigation and responsive composition

Desktop primary navigation contains only Home, Library, and Search. Workspace selection and Upload remain global; identity, workspace settings, and sign out live in the account menu.

Study uses a transcript-first desktop layout with the assistant on the right when space permits. At mobile widths, Transcript, Ask, and Details become keyboard-operable tabs instead of one long stack. Upload and workspace deletion use contained dialogs with Escape, focus trapping, and focus restoration.

## Preserved behavior

The refinement changes presentation and information hierarchy, not product contracts. Authentication, workspace provisioning and switching, upload validation, lifecycle polling, deep-link hydration, transcript display, both search scopes, assistant request safety, citation navigation, and deletion behavior continue through the existing feature hooks and Spring API modules.

Explicit indexing remains available only as recovery while a transcript is ready and automatic search preparation has not completed.
