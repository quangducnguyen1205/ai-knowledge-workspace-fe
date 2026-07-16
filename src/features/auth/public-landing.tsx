import type { MouseEvent } from 'react';
import { routeToHash, type AppRoute } from '../../app/router';

export function PublicLanding({ navigate }: { navigate: (route: AppRoute) => void }) {
  function publicLink(route: AppRoute) {
    return {
      href: routeToHash(route),
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        navigate(route);
      },
    };
  }

  return (
    <div className="public-site">
      <header className="public-header">
        <a className="public-brand" aria-label="AI Knowledge Workspace home" {...publicLink({ name: 'home' })}>
          <span className="public-brand__mark" aria-hidden="true">AK</span>
          <strong>AI Knowledge Workspace</strong>
        </a>
        <nav className="public-header__actions" aria-label="Account navigation">
          <a className="button button--ghost" {...publicLink({ name: 'login' })}>Sign in</a>
          <a className="button button--primary" {...publicLink({ name: 'register' })}>Get started</a>
        </nav>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__copy">
            <p className="hero__eyebrow">Learn from every video</p>
            <h1 id="landing-title">Turn long videos into knowledge you can find and trust.</h1>
            <p>
              Keep transcripts, exact moments, and cited answers together in one focused learning workspace.
            </p>
            <div className="landing-hero__actions">
              <a className="button button--primary" {...publicLink({ name: 'register' })}>Get started</a>
              <a className="button button--ghost" {...publicLink({ name: 'login' })}>Sign in</a>
            </div>
          </div>

          <div className="product-preview" aria-label="Product preview">
            <div className="product-preview__bar">
              <span className="product-preview__dot" aria-hidden="true" />
              <strong>Learning Science</strong>
              <span className="status-badge status-badge--searchable">Ready</span>
            </div>
            <div className="product-preview__body">
              <div className="product-preview__transcript">
                <span>Transcript</span>
                <p>Retrieval practice strengthens recall by bringing information back to mind.</p>
                <p>Short, spaced recall sessions help learning last beyond the first review.</p>
              </div>
              <div className="product-preview__answer">
                <span>Ask this video</span>
                <strong>How does retrieval practice support memory?</strong>
                <p>It strengthens recall by asking learners to actively retrieve what they studied.</p>
                <small>2 cited moments</small>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-capabilities" aria-labelledby="capabilities-title">
          <div className="landing-section-heading">
            <p className="hero__eyebrow">One learning flow</p>
            <h2 id="capabilities-title">From video to a grounded answer</h2>
          </div>
          <div className="capability-grid">
            <article>
              <span aria-hidden="true">01</span>
              <h3>Upload and transcribe</h3>
              <p>Add a video and return when its readable transcript is ready.</p>
            </article>
            <article>
              <span aria-hidden="true">02</span>
              <h3>Search exact moments</h3>
              <p>Find a phrase across your workspace or inside one video.</p>
            </article>
            <article>
              <span aria-hidden="true">03</span>
              <h3>Ask with citations</h3>
              <p>Get a concise answer and open the transcript moments behind it.</p>
            </article>
          </div>
        </section>

        <section className="landing-workflow" aria-labelledby="workflow-title">
          <div>
            <p className="hero__eyebrow">How it works</p>
            <h2 id="workflow-title">Upload. Find. Understand.</h2>
          </div>
          <ol>
            <li><span>1</span>Choose a learning video.</li>
            <li><span>2</span>Search or read its transcript.</li>
            <li><span>3</span>Ask a question and follow the citations.</li>
          </ol>
        </section>
      </main>

      <footer className="public-footer">
        <span>AI Knowledge Workspace</span>
        <a {...publicLink({ name: 'login' })}>Sign in</a>
      </footer>
    </div>
  );
}
