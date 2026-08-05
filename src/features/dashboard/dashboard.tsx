import type { ReactNode } from 'react';
import type { AssetSummary } from '../assets/public';
import { Button, EmptyState, Section } from '../../shared/ui';
import { useDateTimeFormat, useTranslation } from '../../shared/i18n';
import { SourceBadge, StatusBadge } from '../assets/public';
import { SpatialMomentScene } from './spatial-moment-scene';

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
  const { t } = useTranslation(['home', 'common']);
  const formatDateTime = useDateTimeFormat();
  const hasAssets = assets.length > 0;
  const processingCount = assets.filter((asset) => asset.assetStatus === 'PROCESSING').length;
  const sceneVariant = !hasAssets
    ? 'welcome' as const
    : searchableAssetCount === 0
      ? 'processing' as const
      : 'returning' as const;
  const recentAssets = [...assets]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="screen-stack home-screen">
      <header className={`home-hero ${hasAssets ? 'home-hero--working' : 'home-hero--welcome'}`}>
        <div className="home-hero__copy">
          <p className="hero__eyebrow">{workspaceName}</p>
          <h1>{t('hero.title')}</h1>
          <p className="home-hero__statement">{t('hero.statement')}</p>

          {hasAssets ? (
            <p className="page-header__summary" aria-label={t('hero.summaryLabel')}>
              <span>{t('common:videoCount', { count: assets.length })}</span>
              {searchableAssetCount > 0 ? <span>{t('hero.readyToSearch', { count: searchableAssetCount })}</span> : null}
              {processingCount > 0 ? <span>{t('hero.processing', { count: processingCount })}</span> : null}
            </p>
          ) : null}

          <div className="home-hero__actions">
            {hasAssets ? (
              <>
                <Button type="button" onClick={onOpenSearch} disabled={searchableAssetCount === 0}>
                  {t('hero.search')}
                </Button>
                <Button type="button" tone="ghost" onClick={onUploadVideo}>{t('hero.addVideo')}</Button>
              </>
            ) : (
              <Button type="button" onClick={onUploadVideo}>{t('hero.addFirstVideo')}</Button>
            )}
          </div>

          {hasAssets && searchableAssetCount === 0 ? (
            <p className="home-hero__note" role="status">{t('hero.searchLocked')}</p>
          ) : null}
        </div>

        <SpatialMomentScene variant={sceneVariant} />
      </header>

      {!hasAssets ? (
        <section className="home-first-steps" aria-labelledby="home-first-steps-title">
          <div>
            <p className="hero__eyebrow">{t('firstSteps.eyebrow')}</p>
            <h2 id="home-first-steps-title">{t('firstSteps.title')}</h2>
          </div>
          <ol>
            <li><span aria-hidden="true">1</span>{t('firstSteps.one')}</li>
            <li><span aria-hidden="true">2</span>{t('firstSteps.two')}</li>
            <li><span aria-hidden="true">3</span>{t('firstSteps.three')}</li>
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
            title={t('recent.title')}
            eyebrow={t('recent.eyebrow')}
            actions={<span className="panel-pill">{t('recent.pill')}</span>}
            className="recent-videos home-current-work__recent"
          >
            {recentAssets.length === 0 ? (
              <div className="home-empty">
                <EmptyState
                  title={t('recent.emptyTitle')}
                  description={t('recent.emptyDescription')}
                />
                <Button type="button" onClick={onUploadVideo}>{t('hero.addVideo')}</Button>
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
          <p className="hero__eyebrow">{t('capabilities.eyebrow')}</p>
          <h2 id="home-capabilities-title">{t('capabilities.title')}</h2>
        </div>
        <div className="home-capabilities__grid">
          <article>
            <h3>{t('capabilities.momentsTitle')}</h3>
            <p>{t('capabilities.momentsBody')}</p>
          </article>
          <article>
            <h3>{t('capabilities.contextTitle')}</h3>
            <p>{t('capabilities.contextBody')}</p>
          </article>
          <article>
            <h3>{t('capabilities.resumeTitle')}</h3>
            <p>{t('capabilities.resumeBody')}</p>
          </article>
        </div>
      </section>
    </div>
  );
}
