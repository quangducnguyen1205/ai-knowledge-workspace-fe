/**
 * Compatibility path. The UI foundation moved to `src/shared/ui` (primitives) and
 * `src/shared/format` (generic formatting); this module re-exports both so existing imports keep
 * working during migration. New code should import from `../shared/ui` / `../shared/format`.
 */
export {
  Button,
  EmptyState,
  ErrorBanner,
  InfoBanner,
  LoadingBlock,
  PanelHeading,
  Section,
  SuccessNotification,
  joinClassNames,
} from '../shared/ui';
export { ErrorFeedback } from '../shared/feedback';
export { formatDateTime, formatScore } from '../shared/format';
