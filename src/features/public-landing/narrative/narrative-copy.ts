/**
 * Single source of the Moment Engine narrative. Every chapter heading and paragraph rendered on
 * the public landing comes from here, so the copy tests can hold the whole story to the shipped
 * product surface: upload/YouTube input, transcripts, workspace-wide lexical search, exact
 * timestamps, canonical context, stable canonical-row links, Saved Moments, playback progress and
 * Continue Watching — and nothing beyond it.
 */

export interface ChapterCopy {
  /** Stable slug used for section ids and anchors. */
  id: string;
  eyebrow: string;
  title: string;
  body: string[];
}

export const HERO_COPY = {
  id: 'raw-video',
  eyebrow: 'Video knowledge, made navigable',
  title: 'Find the exact moment in every video.',
  body: [
    'Turn long-form video into searchable knowledge. Search what was said, reopen the precise timestamp, and continue where the useful idea began.',
  ],
} as const satisfies ChapterCopy;

export const NARRATIVE_CHAPTERS: readonly ChapterCopy[] = [
  {
    id: 'transcript-layers',
    eyebrow: 'From footage to structure',
    title: 'Every spoken idea becomes searchable.',
    body: [
      'A video is no longer one long timeline. It becomes canonical transcript rows, timestamps and surrounding context that the workspace can navigate.',
    ],
  },
  {
    id: 'workspace-search',
    eyebrow: 'Workspace-wide search',
    title: 'Search across the whole workspace.',
    body: [
      'Find the idea even when you do not remember which video contained it.',
    ],
  },
  {
    id: 'exact-moment',
    eyebrow: 'The exact moment',
    title: 'Jump directly to the moment that matters.',
    body: [
      'Open the exact transcript row, see its canonical context, and seek to the matching timestamp.',
    ],
  },
  {
    id: 'preserve-the-moment',
    eyebrow: 'Saved Moments and progress',
    title: 'Save the moment. Return when it matters.',
    body: [
      'Keep canonical moments, copy their exact location, and continue watching from your last real position.',
    ],
  },
  {
    id: 'enter-the-workspace',
    eyebrow: 'Start with your own videos',
    title: 'Your videos already contain the answer.',
    body: [
      'Make every moment searchable.',
    ],
  },
];

/** The workspace-search example query shown in chapter three. */
export const SEARCH_QUERY_EXAMPLE = '“retrieval practice”';

/** Shipped capabilities named in the closing chapter — no more, no less. */
export const CLOSING_CAPABILITIES = [
  'Workspace search',
  'Transcript context',
  'Saved Moments',
  'Continue Watching',
] as const;
