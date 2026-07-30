import type { ReactNode } from 'react';
import type { AssetSummary } from '../assets/model/types';
import { Button, EmptyState, Section } from '../../shared/ui';
import { formatDateTime } from '../../shared/format';
import { SourceBadge } from '../assets/components/source-badge';
import { StatusBadge } from '../assets/components/status-badge';

type WorkspaceHomeScreenProps = {
  workspaceName: string;
  assets: AssetSummary[];
  selectedAsset: AssetSummary | null;
  searchableAssetCount: number;
  /** Feature-owned panels composed by the router; the home screen only arranges them. */
  continueWatching?: ReactNode;
  savedMoments?: ReactNode;
  onUploadVideo: () => void;
  onOpenSearch: () => void;
  onOpenAsset: (assetId: string) => void;
};

/**
 * Illustrative search-to-moment composition built from the product's own motifs: a query, one
 * result, three transcript lines with the exact hit, and the stable-link cue. It is visibly an
 * example — never production data — and only appears while the workspace has no videos yet.
 */
function MomentPreview() {
  return (
    <div className="moment-preview" role="img" aria-label="Example of searching a workspace and landing on the exact spoken moment">
      <div className="moment-preview__search" aria-hidden="true">
        <span className="moment-preview__query">&ldquo;retrieval practice&rdquo;</span>
        <span className="moment-preview__scope">Whole workspace</span>
        <span className="moment-preview__example-pill">Example</span>
      </div>
      <div className="moment-preview__result" aria-hidden="true">
        <div className="moment-preview__result-header">
          <strong>Learning Science Lecture</strong>
          <span className="source-badge">Upload</span>
          <span className="moment-preview__timestamp">12:40</span>
        </div>
        <ol className="moment-preview__transcript">
          <li>…we compared passive review with active recall sessions.</li>
          <li className="moment-preview__hit">
            <span>12:40</span>
            Retrieval practice strengthens memory by asking you to recall it.
          </li>
          <li>That effect compounds when the sessions are spaced over days.</li>
        </ol>
        <p className="moment-preview__link">Opens at this exact row — its link stays stable.</p>
      </div>
    </div>
  );
}

export function WorkspaceHomeScreen({
  workspaceName,
  assets,
  selectedAsset,
  searchableAssetCount,
  continueWatching,
  savedMoments,
  onUploadVideo,
  onOpenSearch,
  onOpenAsset,
}: WorkspaceHomeScreenProps) {
  const hasAssets = assets.length > 0;
  const processingCount = assets.filter((asset) => asset.assetStatus === 'PROCESSING').length;
  const recentAssets = [...assets]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="screen-stack home-screen">
      <header className={`home-hero ${hasAssets ? '' : 'home-hero--welcome'}`}>
        <div className="home-hero__copy">
          <p className="hero__eyebrow">{workspaceName}</p>
          <h1>Find the exact moment in every video.</h1>
          <p className="home-hero__statement">
            Search across a workspace of videos and jump directly to the exact moments that
            matter — every video becomes a transcript you can search, revisit and resume.
          </p>

          {hasAssets ? (
            <p className="page-header__summary" aria-label="Workspace video summary">
              <span>{assets.length} {assets.length === 1 ? 'video' : 'videos'}</span>
              {searchableAssetCount > 0 ? <span>{searchableAssetCount} ready to search</span> : null}
              {processingCount > 0 ? <span>{processingCount} processing</span> : null}
            </p>
          ) : null}

          <div className="home-hero__actions">
            {hasAssets ? (
              <>
                <Button type="button" onClick={onOpenSearch} disabled={searchableAssetCount === 0}>
                  Search this workspace
                </Button>
                <Button type="button" tone="ghost" onClick={onUploadVideo}>Add video</Button>
              </>
            ) : (
              <Button type="button" onClick={onUploadVideo}>Add your first video</Button>
            )}
          </div>

          {hasAssets && searchableAssetCount === 0 ? (
            <p className="home-hero__note" role="status">
              Search unlocks as soon as a transcript finishes processing.
            </p>
          ) : null}
        </div>

        {!hasAssets ? <MomentPreview /> : null}
      </header>

      {!hasAssets ? (
        <section className="home-first-steps" aria-labelledby="home-first-steps-title">
          <div>
            <p className="hero__eyebrow">First steps</p>
            <h2 id="home-first-steps-title">From video to searchable moments</h2>
          </div>
          <ol>
            <li>
              <span aria-hidden="true">1</span>
              Add a video — upload a file or paste a YouTube link.
            </li>
            <li>
              <span aria-hidden="true">2</span>
              Its transcript is prepared automatically while you keep working.
            </li>
            <li>
              <span aria-hidden="true">3</span>
              Search what was said, open the exact timestamped moment, and save it.
            </li>
          </ol>
        </section>
      ) : (
        <div className="home-current-work">
          {continueWatching ? (
            <div className="panel home-current-work__cell">{continueWatching}</div>
          ) : null}
          {savedMoments ? (
            <div className="panel home-current-work__cell">{savedMoments}</div>
          ) : null}
          <Section
            title="Recent videos"
            eyebrow="Library"
            actions={<span className="panel-pill">Latest first</span>}
            className="recent-videos home-current-work__recent"
          >
            {recentAssets.length === 0 ? (
              <div className="home-empty">
                <EmptyState
                  title="Your first video starts here"
                  description="Upload a file or add a YouTube URL and its transcript will appear in this workspace."
                />
                <Button type="button" onClick={onUploadVideo}>Add video</Button>
              </div>
            ) : (
              <div className="recent-video-grid">
                {recentAssets.map((asset) => (
                  <button
                    key={asset.assetId}
                    type="button"
                    className={`recent-video ${selectedAsset?.assetId === asset.assetId ? 'recent-video--active' : ''}`}
                    onClick={() => onOpenAsset(asset.assetId)}
                  >
                    <span className="recent-video__icon" aria-hidden="true">▶</span>
                    <span className="recent-video__copy">
                      <strong>{asset.title}</strong>
                      <span className="video-row__meta">
                        <small>{formatDateTime(asset.createdAt)}</small>
                        <SourceBadge sourceType={asset.sourceType} />
                      </span>
                    </span>
                    <StatusBadge status={asset.assetStatus} />
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      <section className="home-capabilities" aria-labelledby="home-capabilities-title">
        <div>
          <p className="hero__eyebrow">What this workspace does</p>
          <h2 id="home-capabilities-title">Built for finding what was said</h2>
        </div>
        <div className="home-capabilities__grid">
          <article>
            <h3>Find exact moments</h3>
            <p>
              Search spoken content across the workspace or inside one video, and jump straight
              to the timestamped row that matches.
            </p>
          </article>
          <article>
            <h3>Keep canonical context</h3>
            <p>
              Every moment opens with its surrounding transcript, and its link keeps working —
              share it or come back to the same row later.
            </p>
          </article>
          <article>
            <h3>Resume and save knowledge</h3>
            <p>
              Playback progress is remembered per video, and saved moments keep the passages you
              want to find again.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
