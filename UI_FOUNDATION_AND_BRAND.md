# UI Foundation and Brand System

One document for the reusable UI foundation, the design-token owner, the hard-coding policy and
the Project3 brand system. Architecture-wide rules stay in `FRONTEND_ARCHITECTURE.md`; this file
is the reference for visual and foundation decisions.

## 1. UI foundation

**Location and public API:** `src/shared/ui`, imported through its entrypoint `src/shared/ui/index.ts`:

- `Button` (semantic tones `primary | secondary | ghost`, ref-forwarded)
- `Section` (card-like page section with owned h2 title)
- `PanelHeading` (shared heading-row layout; the heading element itself stays caller-owned so
  features keep ids, refs, `tabIndex` and accessible relationships)
- `ErrorBanner` / `InfoBanner` / `SuccessNotification` (bounded feedback; `role=alert` / `role=status`)
- `LoadingBlock`, `EmptyState`
- `useEphemeralNotice`, `joinClassNames`

Generic formatting lives in `src/shared/format` (`formatDateTime`, `formatScore`). Domain
formatting stays with its owner (transcript timestamps in `entities/transcript`).

`src/lib/ui.tsx` is a compatibility re-export only, kept so existing imports migrate gradually —
the same coexistence discipline the Viettel/Tendoo reference uses between its old theme layer and
its new foundation package. New code imports `shared/ui` / `shared/format` directly.

**Dependency boundary** (enforced by `src/app/architecture/import-boundaries.test.ts`):

```text
allowed:      shared/lib tier → React, neutral third-party, other shared/lib modules
forbidden:    shared/lib tier → app, routing, features, entities, React Query
consumption:  page/screen → feature composition → feature components → shared primitives → tokens
```

**Primitive versus feature-owned rule.** A component moves into `shared/ui` only when it is
already duplicated, encodes a cross-product accessibility rule, or owns a shared visual semantic.
Variants are semantic, never page or feature names. Business components stay feature-owned and
consume primitives: `ContinueWatchingPanel`, `SavedMomentsPanel`, search result groups, the
transcript viewer, playback resume, the Workspace selector, `SourceBadge`/`StatusBadge` (their
meanings are Asset domain state).

**Deferred, deliberately:** `IconButton`, `Stack`/`Inline` wrappers, `Dialog` shell, `FormField`/
`TextInput`/`Select`, `VisuallyHidden` component (a `.visually-hidden` utility class already
exists), a settings-action heading variant. None currently meets the reuse threshold; abstracting
them now would be speculative.

## 2. Design tokens

**Owner:** `src/shared/theme/tokens.css`, imported first by `src/styles.css`. Raw palette values
are legal only there (enforced by `src/shared/theme/theme.test.ts` for the brand and playback
families). Components consume semantic names: color (`--primary*`, `--text*`, `--surface*`,
`--border*`, status), typography (`--font-body`, `--font-display`), geometry (spacing, radii,
`--radius-control`, shadows, `--content-width`), layers (`--layer-*`), motion (`--motion-fast/base/slow`,
`--ease-standard`) and one focus color (`--focus`).

Canonical responsive breakpoints (media queries cannot read custom properties): `1080px`,
`900px`, `760px`, `430px` — reuse these instead of inventing new ones.

**Hard-coding policy.** Replace a literal with a token when it represents a shared decision:
brand or status color, focus color, shared spacing/radius/shadow, content width, motion duration,
breakpoint, z-index layer — and equally for route construction and React Query keys, which live
with their owners (`app/router`, `search-keys`, `auth-keys`, `assetKeys`, …). Keep a value local
when it is one component's own layout fact (a unique grid column, a hero offset, one-off white
overlays on dark bands, copy used once, data-test ids). The goal is **no scattered shared
decisions**, not zero literals.

## 3. Brand discovery

Observed evidence before this refinement: deep teal `#176f64` appeared in 13 scattered literals
plus tokens (primary actions, transcript seek chips, selected rows, capability markers); ink
`#192234` text on warm-ivory `#f6f2eb` → cool `#eef3f7` washes with a faint amber glow; a serif
display face over a humanist sans body; indigo `#3159cb` on informational badges and both focus
rings and a *second*, unrelated blue ramp (`#2563eb`, `#eff6ff`, `#dbeafe`, `#1d4ed8`) marking the
currently-playing transcript row; three near-identical body-text grays (`#354052`, `#313b4d`,
`#2d3748`); teal at nine arbitrary alpha values; two competing focus-ring colors.

There was a de-facto brand — calm deep teal on warm ivory with an editorial serif — but no formal
system. This refinement formalizes it rather than inventing a new identity: it already matches the
product's personality (a calm, intelligent video knowledge workspace) and avoids generic AI
clichés (no neon gradients, no glow effects, no fake metrics).

## 4. Final palette

| Token | Value | Purpose | Contrast notes |
|---|---|---|---|
| `--primary` | `#176f64` | Brand, primary actions | 6.01:1 vs white — AA text both directions |
| `--primary-strong` | `#10564f` | Hover/active, emphasis | 7.13:1 on `--primary-soft` (AAA) |
| `--primary-soft` | `#dcefeb` | Brand wash, secondary buttons | background only |
| `--primary-border` / `--primary-ring` | teal α 0.2 / 0.3 | borders, rings, glows | non-text |
| `--ink` | `#111827` | Dark anchor surfaces (players, workflow band) | white on ink 17.74:1 |
| `--text` / `--text-secondary` / `--text-muted` | `#192234` / `#354052` / `#6d788b` | primary / body / meta text | 14.26:1 on warm bg; 10.47:1; 4.46:1 (AA, meta only) |
| `--bg-warm` → `--bg-cool` | `#f6f2eb` → `#eef3f7` | Page background wash | with restrained amber/indigo glow |
| `--blue` / `--blue-soft` | `#3159cb` / `#edf2ff` | Informational status accent | 5.48:1 on soft (AA) |
| `--focus` | indigo α 0.34 | The one focus ring (3px + offset) | visible on teal, ivory and white |
| `--playback*` | `#2563eb` family | Playing-row semantic, distinct from teal selection | 5.49:1 strong-on-chip |
| `--danger` / `--warning` / `--success` | `#ae4141` / `#9c5c20` / `#1f7657` | Status | 5.26 / 4.91 / 5.10 on their soft surfaces (AA) |

Typography: display serif stack (`Iowan Old Style`, Palatino, Georgia) for h1/h2; body sans stack
(`Avenir Next`, Segoe UI); no remote fonts. Motion: 120/160/420 ms with one standard easing;
non-essential motion collapses under `prefers-reduced-motion: reduce`.

## 5. Landing surface

The application has two entry surfaces: a public signed-out landing (`PublicLanding`) and the
authenticated Workspace Home (`#/`, `features/dashboard`). The **authenticated Workspace Home** is
the practical product landing — it is where every returning user starts — so the premium redesign
targets it: hero with the real product statement, a product-preview composition built from
DOM/CSS transcript motifs, current work (Continue watching, Recent videos, Saved moments — three
distinct meanings), and a capability section grounded only in shipped features. New users without
Assets get an actionable first-video page instead of three empty panels; no fake sample data,
metrics, logos or testimonials anywhere. Auth flow, routes, Workspace selection, API calls and
error/loading behavior are unchanged.

## 6. Lessons taken from the Viettel/Tendoo reference (and what was not copied)

Adapted principles: one token owner with semantic aliases over a raw palette; a foundation-only
public entrypoint; downward-only dependency direction enforced mechanically; canonical components
with semantic variants and accessibility encoded in the API; old and new layers coexisting during
migration instead of a big-bang rename; motion as a system that never overrides the OS
reduced-motion preference. Not copied: Viettel branding and palette, antd and framer-motion
dependencies, the `src/base/uiKit` folder naming, domain kits, i18n infrastructure, or any
proprietary component code. Enforcement here uses the existing Vitest architecture tests rather
than a new ESLint plugin dependency.
