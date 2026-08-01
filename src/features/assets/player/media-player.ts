/**
 * Provider-neutral media player contract shared by every Study playback adapter.
 *
 * Only genuinely neutral behavior belongs here. Provider constants, provider state
 * numbers and browser media-element details stay inside their owning adapter.
 */

export type MediaSeekOptions = {
  /**
   * Position the player without starting playback.
   *
   * Opening a moment positions the player for the learner, so it must never start playback on
   * its own. A plain seek is not enough on every provider: some start playing when they are
   * seeked from a state they have not played from yet. Each adapter owns how it honors this.
   */
  keepPaused?: boolean;
};

export type MediaPlayerHandle = {
  seekToMs(timeMs: number, options?: MediaSeekOptions): void;
  play(): void;
};

export type MediaPlaybackState =
  | 'unstarted'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'cued'
  | 'error';

export type MediaPlaybackSnapshot = {
  state: MediaPlaybackState;
  positionMs: number | null;
};

/**
 * Documented conversion rule for every adapter: provider seconds become integer
 * milliseconds by flooring, and unusable positions become `null`.
 */
export function toPlaybackPositionMs(seconds: number): number | null {
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.floor(seconds * 1_000)
    : null;
}
