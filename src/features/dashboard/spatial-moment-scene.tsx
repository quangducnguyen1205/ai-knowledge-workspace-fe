import { useRef } from 'react';
import { useTranslation } from '../../shared/i18n';
import { usePointerDepth } from './use-pointer-depth';

export type SpatialMomentSceneVariant = 'welcome' | 'processing' | 'returning';

const CAPTION_KEYS = {
  welcome: 'scene.captionWelcome',
  processing: 'scene.captionProcessing',
  returning: 'scene.captionReturning',
} as const satisfies Record<SpatialMomentSceneVariant, string>;

/**
 * Decorative spatial rendering of the real product flow: video → transcript layers → search
 * signal → timestamp → selected canonical row → stable-link marker. Built from semantic DOM and
 * CSS 3D only, feature-owned on purpose (its motifs are this product's, not a reusable
 * primitive). The whole scene carries one accessible description; every sublayer is hidden from
 * assistive technology and keyboard navigation, and all real CTAs live outside it. Content is
 * always illustrative and labelled as an example — never production data.
 */
export function SpatialMomentScene({ variant }: { variant: SpatialMomentSceneVariant }) {
  const { t } = useTranslation('home');
  const stageRef = useRef<HTMLDivElement>(null);
  usePointerDepth(stageRef);

  return (
    <figure
      className={`moment-scene moment-scene--${variant}`}
      role="img"
      aria-label={t('scene.label')}
    >
      <div ref={stageRef} className="moment-scene__stage" aria-hidden="true">
        <div className="moment-scene__space">
          <div className="moment-scene__plane moment-scene__plane--video">
            <span className="moment-scene__play">▶</span>
            <span className="moment-scene__video-title">{t('scene.videoTitle')}</span>
            <div className="moment-scene__rail">
              <span className="moment-scene__rail-marker" />
            </div>
            <span className="moment-scene__stamp">12:40</span>
          </div>

          <div className="moment-scene__plane moment-scene__plane--layer moment-scene__plane--back">
            <span />
            <span />
            <span />
          </div>
          <div className="moment-scene__plane moment-scene__plane--layer moment-scene__plane--mid">
            <span />
            <span />
            <span />
          </div>

          <div className="moment-scene__plane moment-scene__plane--result">
            <div className="moment-scene__query">
              <span className="moment-scene__query-glyph">⌕</span>
              <span>&ldquo;retrieval practice&rdquo;</span>
            </div>
            <ol className="moment-scene__rows">
              <li>{t('scene.rowBefore')}</li>
              <li className="moment-scene__hit">
                <span>12:40</span>
                {t('scene.rowHit')}
              </li>
              <li>{t('scene.rowAfter')}</li>
            </ol>
            <p className="moment-scene__link">{t('scene.link')}</p>
          </div>
        </div>
      </div>

      <figcaption className="moment-scene__caption">
        <span className="moment-scene__example-pill">{t('scene.example')}</span>
        {t(CAPTION_KEYS[variant])}
      </figcaption>
    </figure>
  );
}
