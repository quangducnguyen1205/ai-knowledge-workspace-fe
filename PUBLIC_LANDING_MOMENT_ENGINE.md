# The Moment Engine — public landing

The public signed-out landing is a cinematic 3D scrollytelling page owned entirely by
`src/features/public-landing`. It tells one story — raw video → transcript layers →
workspace-wide search → exact timestamped moment → canonical context → Saved Moment and
Continue Watching → enter the workspace — as six connected scroll chapters over a single
continuous camera journey. This document is the reference for its ownership, scene
architecture, motion policy, fallbacks and performance budget. Brand and foundation rules for
the rest of the product stay in `UI_FOUNDATION_AND_BRAND.md`.

## Ownership and boundaries

```text
src/features/public-landing/
├── public-landing.tsx        HTML shell: header, six chapters, CTAs, footer, error boundary
├── public-landing.css        landing-owned dark theme layer (all selectors namespaced .me-)
├── narrative/                copy source, chapter section, reveal hook, scroll timeline (GSAP)
├── scene/                    WebGL layer: canvas, scene, camera rig, planes, beam, moment node
├── fallback/                 static HTML/CSS compositions for every chapter
└── tests/                    content, accessibility, route scope, boundaries, lifecycle, responsive
```

Enforced by `tests/landing-boundaries.test.ts`:

- `three`, `@react-three/*` and `gsap` may be imported only inside this feature;
- only `app/AppRouter.tsx` may reach the landing, and only through `React.lazy`;
- the landing never imports product APIs, React Query, entities or other features
  (it consumes only `app/router` for navigation and shared typography tokens);
- the scene chunk stays out of the landing HTML chunk: `public-landing.tsx` reaches
  `scene/moment-engine-canvas` exclusively via a lazy dynamic import, and GSAP's single
  owner (`narrative/use-scroll-progress.ts`) is imported only by that scene chunk.

The landing defines its own dark palette as `--me-*` custom properties on `.me-landing`.
Shared design tokens were not changed for it; the two focus-ring values intentionally match
(`--me-focus` = the app's `--focus-on-dark`).

## Route and bundle isolation

`AppRouter` renders the landing for the unauthenticated home route through `React.lazy` with an
ink-colored Suspense fallback (no white flash). The build therefore produces three relevant
chunks:

- application chunk (authenticated app; does not contain the landing),
- landing HTML chunk (narrative, CSS, capability gate — loads instantly),
- scene chunk (three + fiber + drei + GSAP — loads only when the capability gate allows WebGL).

Authenticated sessions never download the scene chunk; leaving the landing unmounts the Canvas
(React Three Fiber disposes the scene graph), the scrubbed ScrollTrigger is reverted via
`gsap.context`, and every window/document listener is removed in effect cleanups — verified by
`tests/landing-lifecycle.test.tsx`, including under React Strict Mode.

## Six chapters

All copy lives in `narrative/narrative-copy.ts` and claims only shipped behavior (workspace-wide
lexical search, exact timestamps, canonical context, stable canonical-row links, Saved Moments,
playback progress, Continue Watching). Chapter 1 carries the only H1 and the real CTAs
(`Enter workspace` → `#/login`, `See how it works` → scroll; header keeps `Sign in`/`Get
started`); chapter 6 closes with `Open your workspace` → `#/register`. The stable-link wording
("copy their exact location") deliberately avoids permanence claims.

## Scroll and camera choreography

One scrubbed ScrollTrigger spans the whole stage (`start: top top`, `end: bottom bottom`) and
writes progress into a mutable store — no React state per scroll event. The camera rig blends
six poses with plateau easing (holds while a chapter's copy is on screen, travels between
chapters) and damps toward the target each frame; every scene object is a pure function of the
same progress value, so backward scroll replays the story exactly in reverse and a mid-scroll
reload snaps to the correct state on the first frame. Pointer drift (precise pointers only) is
capped at ≈5°, damped, and never competes with the scroll-owned pose.

Rendering is demand-based (`frameloop="demand"`): frames are produced only while scroll
progress changes, the pointer drifts, or the camera is still settling. A hidden tab or idle
page renders nothing.

## Mobile, reduced motion and fallback

The capability gate (`scene/scene-quality.ts`) resolves one of:

- **immersive/high** — wide precise-pointer viewports with WebGL (DPR capped at 1.5);
- **immersive/lite** — ≤1080px or modest CPUs: DPR 1, fewer transcript sheets, no particles,
  no beam light;
- **static** — any of: `prefers-reduced-motion`, coarse pointer, ≤900px, <4 cores, missing or
  failing WebGL, or a scene-chunk load/render error (silently caught by an error boundary).

Static mode renders polished HTML/CSS compositions per chapter (video frame, fanned transcript
sheets, search beam, locked row with amber marker, preserved moment card, composed workspace) in
normal document flow — no pinning, no hidden content, complete narrative and CTAs. Copy reveal
is opt-in: content is fully visible by default and the reveal class is added only when
IntersectionObserver exists and motion is allowed.

## Accessibility

One H1 and five chapter H2s in order; every section is `aria-labelledby` its own heading;
semantic `main`/`banner`/`contentinfo`; a skip link to `#me-main`; the WebGL layer and every
static visual are `aria-hidden` with nothing interactive or focusable inside; CTAs are real
links/buttons with ≥44px targets and a 3px `--me-focus` outline. No scroll hijacking: the wheel
is never intercepted; scrolling is ordinary document scroll.

## Performance budget (vite build, gzip)

- Baseline before this feature: one `index` chunk 413.62 kB (119.13 kB gzip), CSS 49.58 kB
  (9.23 kB gzip).
- After: application chunk `index` 410.87 kB (119.00 kB gzip — slightly smaller: the old
  landing left the eager bundle); landing HTML chunk `public-landing` 11.04 kB (3.37 kB gzip)
  + landing CSS 10.76 kB (2.97 kB gzip); lazy scene chunk `moment-engine-canvas` 968.97 kB
  (276.42 kB gzip); shared app CSS shrank to 45.62 kB (8.58 kB gzip — dead landing CSS
  removed).
- Net for a signed-in user: ≈ ±0 (landing and scene chunks never load; the app chunk shrank).
- Net for a signed-out visitor before WebGL: ≈ +5.7 kB gzip (landing HTML + CSS).
- The scene chunk (three + fiber + drei + GSAP) loads only behind the capability gate; Vite's
  >500 kB warning refers to this deliberately isolated lazy chunk.

New dependencies (all local, no runtime CDN assets, no tracking): `three` 0.169.0,
`@react-three/fiber` 8.18.0, `@react-three/drei` 9.122.0 (RoundedBox and Line only), `gsap`
3.15.0 (ScrollTrigger), `@types/three` (dev). All scene textures are procedurally drawn
offscreen canvases; fonts are the existing system stacks.

## Non-impact on the authenticated application

The authenticated Workspace Home, AppShell, auth surfaces, Library, Search, Viewer, Upload,
playback, Saved Moments, Continue Watching, settings, shared tokens and shared/ui are untouched
by this feature (the retired `features/auth/public-landing.tsx` and its dead CSS were removed).
`tests/landing-route.test.tsx` proves an authenticated session renders the existing application
with no landing markup and no canvas mounted.
