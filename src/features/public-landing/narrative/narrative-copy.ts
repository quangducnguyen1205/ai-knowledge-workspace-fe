/**
 * The shape of the Moment Engine narrative: which chapters exist, in which order, and which
 * translation key carries each part. The words live in the `landing` namespace, so the story
 * reads in the visitor's language while this file stays the single owner of its structure.
 *
 * The story is held to the shipped product surface — upload/YouTube input, transcripts,
 * workspace-wide lexical search, exact timestamps, canonical context, stable canonical-row links,
 * Saved Moments, playback progress and Continue Watching — and nothing beyond it. The copy tests
 * assert that against the rendered narrative in the default language.
 */

import type { TranslationKey } from '../../../shared/i18n';

/** A key that actually exists in the `landing` namespace, checked at compile time. */
type LandingKey = TranslationKey<'landing'>;

export interface ChapterCopy {
  /** Stable slug used for section ids and anchors. Never translated. */
  id: string;
  eyebrowKey: LandingKey;
  titleKey: LandingKey;
  bodyKeys: readonly LandingKey[];
}

export const HERO_COPY = {
  id: 'raw-video',
  eyebrowKey: 'hero.eyebrow',
  titleKey: 'hero.title',
  bodyKeys: ['hero.body'],
} as const satisfies ChapterCopy;

export const NARRATIVE_CHAPTERS: readonly ChapterCopy[] = [
  {
    id: 'transcript-layers',
    eyebrowKey: 'chapters.transcriptLayers.eyebrow',
    titleKey: 'chapters.transcriptLayers.title',
    bodyKeys: ['chapters.transcriptLayers.body'],
  },
  {
    id: 'workspace-search',
    eyebrowKey: 'chapters.workspaceSearch.eyebrow',
    titleKey: 'chapters.workspaceSearch.title',
    bodyKeys: ['chapters.workspaceSearch.body'],
  },
  {
    id: 'exact-moment',
    eyebrowKey: 'chapters.exactMoment.eyebrow',
    titleKey: 'chapters.exactMoment.title',
    bodyKeys: ['chapters.exactMoment.body'],
  },
  {
    id: 'preserve-the-moment',
    eyebrowKey: 'chapters.preserveTheMoment.eyebrow',
    titleKey: 'chapters.preserveTheMoment.title',
    bodyKeys: ['chapters.preserveTheMoment.body'],
  },
  {
    id: 'enter-the-workspace',
    eyebrowKey: 'chapters.enterTheWorkspace.eyebrow',
    titleKey: 'chapters.enterTheWorkspace.title',
    bodyKeys: ['chapters.enterTheWorkspace.body'],
  },
];

/**
 * The workspace-search example query shown in chapter three.
 *
 * Deliberately not translated: it stands in for something a user typed, and search matches the
 * words actually spoken in a video rather than a translation of them.
 */
export const SEARCH_QUERY_EXAMPLE = '“retrieval practice”';

/** Shipped capabilities named in the closing chapter — no more, no less. */
export const CLOSING_CAPABILITY_KEYS = [
  'capabilities.workspaceSearch',
  'capabilities.transcriptContext',
  'capabilities.savedMoments',
  'capabilities.continueWatching',
] as const;
