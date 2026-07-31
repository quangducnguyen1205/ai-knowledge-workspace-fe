/**
 * Polished HTML/CSS stand-ins for the WebGL scene. They carry the same six visual beats — video,
 * transcript layers, workspace search, exact moment, preserved moment, composed workspace — for
 * reduced motion, coarse pointers, narrow viewports, missing WebGL and scene-chunk failures.
 * Purely decorative: every visual is aria-hidden and contains nothing interactive.
 */

function TranscriptLines({ count, highlight }: { count: number; highlight?: number }) {
  return (
    <span className="me-static__lines">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={index === highlight ? 'me-static__line me-static__line--match' : 'me-static__line'}
        />
      ))}
    </span>
  );
}

function VideoFrame({ compact }: { compact?: boolean }) {
  return (
    <span className={compact ? 'me-static__video me-static__video--compact' : 'me-static__video'}>
      <span className="me-static__screen" />
      <span className="me-static__rail">
        <span className="me-static__rail-marker" />
      </span>
    </span>
  );
}

export function StaticChapterVisual({ chapter }: { chapter: 1 | 2 | 3 | 4 | 5 | 6 }) {
  if (chapter === 1) {
    return (
      <div className="me-static me-static--raw" aria-hidden="true">
        <VideoFrame />
        <span className="me-static__fragments">
          <span /><span /><span />
        </span>
      </div>
    );
  }

  if (chapter === 2) {
    return (
      <div className="me-static me-static--layers" aria-hidden="true">
        <VideoFrame compact />
        <span className="me-static__sheets">
          <span className="me-static__sheet"><i>00:41</i><TranscriptLines count={3} /></span>
          <span className="me-static__sheet"><i>04:17</i><TranscriptLines count={3} /></span>
          <span className="me-static__sheet"><i>12:05</i><TranscriptLines count={3} /></span>
        </span>
      </div>
    );
  }

  if (chapter === 3) {
    return (
      <div className="me-static me-static--search" aria-hidden="true">
        <span className="me-static__beam" />
        <span className="me-static__stack me-static__stack--dim"><TranscriptLines count={4} /></span>
        <span className="me-static__stack me-static__stack--match"><TranscriptLines count={4} highlight={1} /></span>
        <span className="me-static__stack me-static__stack--dim"><TranscriptLines count={4} /></span>
      </div>
    );
  }

  if (chapter === 4) {
    return (
      <div className="me-static me-static--moment" aria-hidden="true">
        <span className="me-static__context">
          <span className="me-static__row"><TranscriptLines count={1} /></span>
          <span className="me-static__row me-static__row--locked"><i>08:52</i><TranscriptLines count={1} highlight={0} /></span>
          <span className="me-static__row"><TranscriptLines count={1} /></span>
        </span>
        <span className="me-static__connector" />
        <span className="me-static__rail me-static__rail--wide">
          <span className="me-static__rail-marker me-static__rail-marker--amber" />
        </span>
      </div>
    );
  }

  if (chapter === 5) {
    return (
      <div className="me-static me-static--saved" aria-hidden="true">
        <span className="me-static__card">
          <i>08:52</i>
          <TranscriptLines count={2} highlight={0} />
          <span className="me-static__badges">
            <span className="me-static__badge me-static__badge--link" />
            <span className="me-static__badge me-static__badge--save" />
            <span className="me-static__badge me-static__badge--progress" />
          </span>
        </span>
        <span className="me-static__constellation">
          <span /><span /><span /><span /><span />
        </span>
      </div>
    );
  }

  return (
    <div className="me-static me-static--workspace" aria-hidden="true">
      <span className="me-static__panel me-static__panel--search"><TranscriptLines count={2} highlight={0} /></span>
      <span className="me-static__panel"><TranscriptLines count={3} /></span>
      <span className="me-static__panel"><TranscriptLines count={2} /></span>
      <span className="me-static__rail me-static__rail--wide">
        <span className="me-static__rail-marker me-static__rail-marker--amber" />
      </span>
    </div>
  );
}
