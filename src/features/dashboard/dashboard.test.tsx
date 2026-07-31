import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ComponentProps } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssetSummary } from '../assets/model/types';
import { WorkspaceHomeScreen } from './dashboard';

const baseAsset: AssetSummary = {
  assetId: 'asset-1',
  title: 'Vector Clocks Lecture',
  assetStatus: 'SEARCHABLE',
  workspaceId: 'workspace-1',
  sourceType: 'UPLOAD',
  youtubeVideoId: null,
  sourceUrl: null,
  createdAt: '2026-07-30T10:00:00Z',
};

function renderHome(overrides: Partial<ComponentProps<typeof WorkspaceHomeScreen>> = {}) {
  const props: ComponentProps<typeof WorkspaceHomeScreen> = {
    workspaceName: 'Distributed Systems',
    assets: [baseAsset],
    selectedAsset: null,
    searchableAssetCount: 1,
    continueWatching: <section aria-label="Continue watching panel">CW panel</section>,
    savedMoments: <section aria-label="Saved moments panel">SM panel</section>,
    onUploadVideo: vi.fn(),
    onOpenSearch: vi.fn(),
    onOpenAsset: vi.fn(),
    ...overrides,
  };
  render(<WorkspaceHomeScreen {...props} />);
  return props;
}

afterEach(cleanup);

describe('workspace home landing', () => {
  it('leads with the real product statement under exactly one h1', () => {
    renderHome();

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Find the exact moment in every video.');
    expect(screen.getByText(/search across a workspace of videos and jump directly/i))
      .toBeInTheDocument();
  });

  it('keeps a logical heading hierarchy with h2 sections under the h1', () => {
    renderHome();

    const levels = screen.getAllByRole('heading')
      .map((heading) => Number(heading.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    expect(levels).not.toContain(4);
    expect(Math.min(...levels.slice(1))).toBeGreaterThanOrEqual(2);
  });

  it('ties the primary actions to real product routes for a returning user', async () => {
    const user = userEvent.setup();
    const props = renderHome();

    await user.click(screen.getByRole('button', { name: 'Search this workspace' }));
    await user.click(screen.getByRole('button', { name: 'Add video' }));

    expect(props.onOpenSearch).toHaveBeenCalledTimes(1);
    expect(props.onUploadVideo).toHaveBeenCalledTimes(1);
  });

  it('arranges current work with distinct ownership: continue watching, saved moments, recent videos', () => {
    renderHome();

    expect(screen.getByLabelText('Continue watching panel')).toBeInTheDocument();
    expect(screen.getByLabelText('Saved moments panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent videos' })).toBeInTheDocument();
    // Recent videos stays a distinct concept from Continue watching.
    expect(screen.queryByRole('heading', { name: 'Continue watching' })).not.toBeInTheDocument();
  });

  it('opens a recent video by its Asset identity', async () => {
    const user = userEvent.setup();
    const props = renderHome();

    await user.click(screen.getByRole('button', { name: /Vector Clocks Lecture/ }));

    expect(props.onOpenAsset).toHaveBeenCalledWith('asset-1');
  });

  it('summarizes real workspace state without invented metrics', () => {
    renderHome({
      assets: [
        baseAsset,
        { ...baseAsset, assetId: 'asset-2', title: 'Consensus', assetStatus: 'PROCESSING' },
      ],
      searchableAssetCount: 1,
    });

    const summary = screen.getByLabelText('Workspace video summary');
    expect(summary).toHaveTextContent('2 videos');
    expect(summary).toHaveTextContent('1 ready to search');
    expect(summary).toHaveTextContent('1 processing');
  });

  it('gives a new user an actionable page with the example scene instead of empty panels', async () => {
    const user = userEvent.setup();
    const props = renderHome({ assets: [], searchableAssetCount: 0 });

    await user.click(screen.getByRole('button', { name: 'Add your first video' }));
    expect(props.onUploadVideo).toHaveBeenCalledTimes(1);

    // The spatial scene is explicitly an example, never production data.
    const scene = screen.getByRole('img', { name: /example of the product flow/i });
    expect(scene).toHaveClass('moment-scene--welcome');
    expect(scene.querySelector('.moment-scene__example-pill')).toHaveTextContent('Example');
    expect(screen.getByRole('heading', { name: 'From video to searchable moments' }))
      .toBeInTheDocument();
    expect(screen.queryByLabelText('Continue watching panel')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Saved moments panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search this workspace' })).not.toBeInTheDocument();
  });

  it('keeps search reachable but explained while transcripts are still processing', () => {
    renderHome({
      assets: [{ ...baseAsset, assetStatus: 'PROCESSING' }],
      searchableAssetCount: 0,
    });

    expect(screen.getByRole('button', { name: 'Search this workspace' })).toBeDisabled();
    expect(screen.getByRole('status'))
      .toHaveTextContent('Search unlocks as soon as a transcript finishes processing.');
    // The scene must not imply search is already available in this workspace.
    const scene = screen.getByRole('img', { name: /example of the product flow/i });
    expect(scene).toHaveClass('moment-scene--processing');
    expect(scene.querySelector('.moment-scene__caption')?.textContent)
      .toContain('Search opens once a transcript finishes processing.');
  });

  it('grounds the capability section in shipped features only', () => {
    renderHome();

    for (const capability of ['Find exact moments', 'Keep canonical context', 'Resume and save knowledge']) {
      expect(screen.getByRole('heading', { name: capability })).toBeInTheDocument();
    }
  });

  it('contains no fake metrics, testimonials, logos or marketing vocabulary', () => {
    renderHome({ assets: [], searchableAssetCount: 0 });

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/testimonial|trusted by|customers|\d+\s*%|★|rating|award/i);
    // Neutral video-knowledge vocabulary only.
    expect(text).not.toMatch(/lesson|course|learner score|study summary/i);
  });

  it('renders the spatial scene as one described image with hidden decorative sublayers', () => {
    renderHome({ assets: [], searchableAssetCount: 0 });

    const scene = screen.getByRole('img', { name: /example of the product flow/i });
    // One concise accessible description on the container; sublayers hidden from AT.
    expect(scene.querySelector('.moment-scene__stage')).toHaveAttribute('aria-hidden', 'true');
    const rows = scene.querySelectorAll('.moment-scene__rows li');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveClass('moment-scene__hit');
    // Truthful canonical-addressing wording: stable addressing, no permanence claim.
    expect(scene.querySelector('.moment-scene__link')?.textContent)
      .toBe('Copy a stable link to this exact canonical row.');
    expect(document.body.textContent)
      .not.toMatch(/keeps working|stays stable|forever|permanent|never breaks?/i);
    // Decorative only: nothing interactive, nothing keyboard-reachable inside the scene.
    expect(scene.querySelectorAll('button, a, input, select, textarea')).toHaveLength(0);
    expect(scene.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('keeps the returning-user scene subordinate while real work leads', () => {
    renderHome();

    const scene = screen.getByRole('img', { name: /example of the product flow/i });
    expect(scene).toHaveClass('moment-scene--returning');
    expect(scene.querySelector('.moment-scene__example-pill')).toHaveTextContent('Example');
    // Real work still renders in full next to the scene.
    expect(screen.getByLabelText('Continue watching panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent videos' })).toBeInTheDocument();
  });

  it('never attaches pointer-depth handling when matchMedia support is absent', () => {
    // jsdom has no matchMedia: the scene must render statically without throwing, which is the
    // same graceful path used for coarse pointers and reduced motion.
    renderHome();

    const space = document.querySelector('.moment-scene__space') as HTMLElement;
    expect(space).not.toBeNull();
    expect(space.style.getPropertyValue('--tilt-x')).toBe('');
  });

  it('is keyboard reachable in a predictable order for a returning user', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Search this workspace' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Add video' })).toHaveFocus();
  });
});

describe('workspace home responsive composition', () => {
  const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('stacks hero, current work and capabilities on narrow viewports', () => {
    const under1080 = styles.slice(styles.indexOf('@media (max-width: 1080px)'));
    const under900 = styles.slice(styles.indexOf('@media (max-width: 900px)'));
    const under760 = styles.slice(styles.indexOf('@media (max-width: 760px)'));

    expect(under1080).toMatch(/\.home-current-work\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(under900).toMatch(/\.home-hero--welcome,\s*\.home-hero--working\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
    // The decorative scene yields entirely to real work on narrow working-state viewports.
    expect(under900).toMatch(/\.home-hero--working \.moment-scene\s*\{[\s\S]*?display:\s*none/);
    expect(under760).toMatch(/\.home-capabilities__grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  });

  it('animates the hero only through tokens so reduced motion disables it', () => {
    expect(styles).toMatch(/\.home-hero\s*\{[\s\S]*?animation:[^;]*var\(--motion-slow\)/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.01ms\s*!important/);
  });
});
