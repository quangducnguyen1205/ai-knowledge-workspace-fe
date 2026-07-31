import { Component, lazy, Suspense, useRef, useState, type ErrorInfo, type MouseEvent, type ReactNode } from 'react';
import { routeToHash, type AppRoute } from '../../app/router';
import { StaticChapterVisual } from './fallback/static-moment-engine';
import {
  CLOSING_CAPABILITIES,
  HERO_COPY,
  NARRATIVE_CHAPTERS,
  SEARCH_QUERY_EXAMPLE,
} from './narrative/narrative-copy';
import { NarrativeSection } from './narrative/narrative-section';
import { isMotionAllowed, useChapterReveal } from './narrative/use-reveal';
import { useSceneProfile } from './scene/scene-quality';
import './public-landing.css';

// The WebGL layer (three, fiber, drei, GSAP) lives in its own chunk and loads only when the
// capability gate allows an immersive scene. The narrative never waits for it.
const MomentEngineCanvas = lazy(() => import('./scene/moment-engine-canvas'));

/** A scene failure silently downgrades to the static composition — never a technical error. */
class SceneErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo) {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function PublicLanding({ navigate }: { navigate: (route: AppRoute) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const profile = useSceneProfile();
  const [sceneFailed, setSceneFailed] = useState(false);
  const immersive = profile.mode === 'immersive' && !sceneFailed;
  const motionAllowed = isMotionAllowed();
  useChapterReveal(rootRef, motionAllowed);

  function publicLink(route: AppRoute) {
    return {
      href: routeToHash(route),
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        navigate(route);
      },
    };
  }

  function scrollToStory(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    document.getElementById('me-chapter-2')?.scrollIntoView({
      behavior: motionAllowed ? 'smooth' : 'auto',
      block: 'start',
    });
  }

  const staticVisual = (chapter: 1 | 2 | 3 | 4 | 5 | 6) =>
    immersive ? undefined : <StaticChapterVisual chapter={chapter} />;

  return (
    <div ref={rootRef} className={`me-landing ${immersive ? 'me-landing--immersive' : 'me-landing--static'}`}>
      <a className="me-skip" href="#me-main">Skip to content</a>

      <header className="me-header">
        <a className="me-brand" aria-label="AI Knowledge Workspace home" {...publicLink({ name: 'home' })}>
          <span className="me-brand__mark" aria-hidden="true">AK</span>
          <strong>AI Knowledge Workspace</strong>
        </a>
        <nav className="me-header__actions" aria-label="Account navigation">
          <a className="me-cta me-cta--ghost" {...publicLink({ name: 'login' })}>Sign in</a>
          <a className="me-cta me-cta--primary" {...publicLink({ name: 'register' })}>Get started</a>
        </nav>
      </header>

      <main id="me-main" className="me-main">
        <div ref={stageRef} className="me-stage">
          {immersive ? (
            <div className="me-stage__scene" aria-hidden="true">
              <SceneErrorBoundary onError={() => setSceneFailed(true)}>
                <Suspense fallback={null}>
                  <MomentEngineCanvas stageRef={stageRef} quality={profile.quality} />
                </Suspense>
              </SceneErrorBoundary>
            </div>
          ) : null}

          <div className="me-chapters">
            <section
              id="me-chapter-1"
              className="me-chapter me-chapter--hero"
              data-chapter="1"
              aria-labelledby="me-hero-title"
            >
              <div className="me-chapter__copy me-hero__copy" data-reveal>
                <p className="me-eyebrow">{HERO_COPY.eyebrow}</p>
                <h1 id="me-hero-title">{HERO_COPY.title}</h1>
                {HERO_COPY.body.map((paragraph) => (
                  <p key={paragraph} className="me-chapter__body">{paragraph}</p>
                ))}
                <div className="me-hero__actions">
                  <a className="me-cta me-cta--primary" {...publicLink({ name: 'login' })}>Enter workspace</a>
                  <button type="button" className="me-cta me-cta--ghost" onClick={scrollToStory}>
                    See how it works
                  </button>
                </div>
              </div>
              {staticVisual(1)}
            </section>

            <NarrativeSection chapter={NARRATIVE_CHAPTERS[0]!} chapterNumber={2} align="end" visual={staticVisual(2)} />

            <NarrativeSection chapter={NARRATIVE_CHAPTERS[1]!} chapterNumber={3} align="start" visual={staticVisual(3)}>
              <p className="me-query" aria-label={`Example search: ${SEARCH_QUERY_EXAMPLE}`}>
                <span aria-hidden="true">{SEARCH_QUERY_EXAMPLE}</span>
              </p>
            </NarrativeSection>

            <NarrativeSection chapter={NARRATIVE_CHAPTERS[2]!} chapterNumber={4} align="end" visual={staticVisual(4)} />

            <NarrativeSection chapter={NARRATIVE_CHAPTERS[3]!} chapterNumber={5} align="start" visual={staticVisual(5)} />

            <NarrativeSection chapter={NARRATIVE_CHAPTERS[4]!} chapterNumber={6} align="center" visual={staticVisual(6)}>
              <ul className="me-capabilities">
                {CLOSING_CAPABILITIES.map((capability) => (
                  <li key={capability}>{capability}</li>
                ))}
              </ul>
              <div className="me-hero__actions">
                <a className="me-cta me-cta--primary" {...publicLink({ name: 'register' })}>Open your workspace</a>
              </div>
            </NarrativeSection>
          </div>
        </div>
      </main>

      <footer className="me-footer">
        <span>AI Knowledge Workspace</span>
        <a {...publicLink({ name: 'login' })}>Sign in</a>
      </footer>
    </div>
  );
}
