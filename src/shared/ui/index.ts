/**
 * Shared UI foundation — the public entrypoint for Project3's reusable primitives.
 *
 * Boundary (enforced by src/app/architecture/import-boundaries.test.ts): this package depends on
 * React and other `shared/` modules only. It must never import app shell, routing, features,
 * entities, feature API modules or React Query, and it carries no product copy beyond neutral
 * control labels. Business components (search results, transcript viewer, saved moments,
 * continue watching, workspace selector, …) stay feature-owned and consume these primitives.
 *
 * Variants are semantic (primary/ghost, info/success/warning), never page or feature names.
 * `src/lib/ui.tsx` remains as a compatibility re-export while existing imports migrate.
 */
export { joinClassNames } from './class-names';
export { Button, type ButtonTone } from './button';
export { Section } from './section';
export { PanelHeading } from './panel-heading';
export { ErrorBanner, InfoBanner, SuccessNotification } from './banners';
export { LoadingBlock } from './loading-block';
export { EmptyState } from './empty-state';
export {
  EPHEMERAL_NOTICE_DURATION_MS,
  useEphemeralNotice,
  type EphemeralNotice,
  type NoticeCopy,
} from './use-ephemeral-notice';
