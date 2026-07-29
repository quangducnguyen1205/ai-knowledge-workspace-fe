import { createRef, type RefObject } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaPlaybackSnapshot, MediaPlayerHandle } from './media-player';
import {
  mapHtmlMediaPlaybackState,
  readHtmlMediaPositionMs,
  supportsNativeMediaPlayback,
  UploadMediaPlayer,
} from './upload-media-player';

type MediaElementStub = {
  play: ReturnType<typeof vi.fn>;
  setPaused(paused: boolean): void;
  setEnded(ended: boolean): void;
  setCurrentTime(seconds: number): void;
  readCurrentTime(): number;
};

function stubMediaElement(
  element: HTMLVideoElement,
  playResult: () => unknown = () => Promise.resolve(),
): MediaElementStub {
  let currentTime = 0;
  let paused = true;
  let ended = false;

  Object.defineProperty(element, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (next: number) => {
      currentTime = next;
    },
  });
  Object.defineProperty(element, 'paused', { configurable: true, get: () => paused });
  Object.defineProperty(element, 'ended', { configurable: true, get: () => ended });

  const play = vi.fn(() => {
    paused = false;
    return playResult();
  });
  Object.defineProperty(element, 'play', { configurable: true, value: play });

  return {
    play,
    setPaused: (next) => {
      paused = next;
    },
    setEnded: (next) => {
      ended = next;
    },
    setCurrentTime: (next) => {
      currentTime = next;
    },
    readCurrentTime: () => currentTime,
  };
}

function getVideo(): HTMLVideoElement {
  const video = screen.getByLabelText('Uploaded video: Uploaded lecture');
  if (!(video instanceof HTMLVideoElement)) throw new Error('Expected a native video element');
  return video;
}

function renderUploadPlayer(
  overrides: {
    assetId?: string;
    ref?: RefObject<MediaPlayerHandle>;
    playbackObservationEnabled?: boolean;
    onPlaybackSnapshot?: (snapshot: MediaPlaybackSnapshot) => void;
  } = {},
) {
  return render(
    <UploadMediaPlayer
      assetId={overrides.assetId ?? 'asset-upload'}
      title="Uploaded lecture"
      ref={overrides.ref}
      playbackObservationEnabled={overrides.playbackObservationEnabled}
      onPlaybackSnapshot={overrides.onPlaybackSnapshot}
    />,
  );
}

beforeEach(() => {
  vi.stubEnv('VITE_AUTHENTICATION_MODE', 'legacy_session');
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('Upload media adapter state mapping', () => {
  const paused = { paused: true, ended: false, currentTime: 0 };
  const playing = { paused: false, ended: false, currentTime: 12 };

  it.each([
    ['error', paused, 'error'],
    ['loadstart', paused, 'unstarted'],
    ['ended', playing, 'ended'],
    ['waiting', playing, 'buffering'],
    ['stalled', playing, 'buffering'],
    ['playing', playing, 'playing'],
    ['pause', { paused: true, ended: false, currentTime: 12 }, 'paused'],
    ['seeking', playing, 'buffering'],
    ['seeking', { paused: true, ended: false, currentTime: 12 }, 'paused'],
    ['seeked', playing, 'playing'],
    ['timeupdate', playing, 'playing'],
    ['loadedmetadata', paused, 'cued'],
    ['canplay', paused, 'cued'],
    ['loadedmetadata', { paused: true, ended: false, currentTime: 4 }, 'paused'],
    ['canplay', playing, 'playing'],
  ] as const)('maps %s to a deterministic neutral state', (eventType, element, expected) => {
    expect(mapHtmlMediaPlaybackState(eventType, element)).toBe(expected);
  });

  it('treats a finished element as ended regardless of the observed event', () => {
    const finished = { paused: true, ended: true, currentTime: 30 };

    expect(mapHtmlMediaPlaybackState('pause', finished)).toBe('ended');
    expect(mapHtmlMediaPlaybackState('timeupdate', finished)).toBe('ended');
  });

  it.each([
    [0, 0],
    [7, 7_000],
    [1.2349, 1_234],
    [4.25, 4_250],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
    [-1, null],
  ] as const)('floors %s seconds to %s milliseconds', (seconds, expected) => {
    expect(readHtmlMediaPositionMs({ paused: true, ended: false, currentTime: seconds }))
      .toBe(expected);
  });
});

describe('Upload native media authentication support', () => {
  it('supports the established session credential and defers bearer delivery', () => {
    expect(supportsNativeMediaPlayback('legacy_session')).toBe(true);
    expect(supportsNativeMediaPlayback('keycloak_jwt')).toBe(false);
  });

  it('renders bounded product copy and no media element in bearer mode', () => {
    vi.stubEnv('VITE_AUTHENTICATION_MODE', 'keycloak_jwt');
    const { container } = renderUploadPlayer();

    expect(screen.getByText('Upload playback is not available in this authentication mode yet.'))
      .toBeInTheDocument();
    expect(screen.getByText('The transcript and other video tools remain available.'))
      .toBeInTheDocument();
    expect(container.querySelector('video')).toBeNull();
    expect(container.innerHTML).not.toMatch(/\/api\/assets|Bearer|token/i);
  });
});

describe('Upload media player surface', () => {
  it('presents a labelled region, native controls and a metadata-only Spring source', () => {
    renderUploadPlayer({ assetId: 'asset-upload-1' });

    expect(screen.getByLabelText('Uploaded video player for Uploaded lecture')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading video…');

    const video = getVideo();
    expect(video).toHaveAttribute('src', '/api/assets/asset-upload-1/media');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(video).toHaveAttribute('playsinline');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).not.toHaveAttribute('crossorigin');
    expect(video).not.toHaveAttribute('download');
  });

  it('moves from loading to ready and reports lifecycle states as neutral snapshots', () => {
    const snapshots: MediaPlaybackSnapshot[] = [];
    renderUploadPlayer({
      playbackObservationEnabled: true,
      onPlaybackSnapshot: (snapshot) => snapshots.push(snapshot),
    });
    const video = getVideo();
    const media = stubMediaElement(video);

    fireEvent.loadStart(video);
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'unstarted', positionMs: 0 });

    fireEvent.loadedMetadata(video);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.queryByText('Loading video…')).not.toBeInTheDocument();
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'cued', positionMs: 0 });

    media.setPaused(false);
    media.setCurrentTime(4.5);
    fireEvent.playing(video);
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'playing', positionMs: 4_500 });

    fireEvent.waiting(video);
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'buffering', positionMs: 4_500 });

    media.setPaused(true);
    fireEvent.pause(video);
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'paused', positionMs: 4_500 });

    media.setEnded(true);
    media.setCurrentTime(30);
    fireEvent.ended(video);
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'ended', positionMs: 30_000 });
  });

  it('emits no redundant snapshot when state and useful position are unchanged', () => {
    const snapshots: MediaPlaybackSnapshot[] = [];
    renderUploadPlayer({
      playbackObservationEnabled: true,
      onPlaybackSnapshot: (snapshot) => snapshots.push(snapshot),
    });
    const video = getVideo();
    const media = stubMediaElement(video);
    media.setPaused(false);
    media.setCurrentTime(2);

    fireEvent.timeUpdate(video);
    fireEvent.timeUpdate(video);
    fireEvent.timeUpdate(video);
    expect(snapshots).toHaveLength(1);

    media.setCurrentTime(2.5);
    fireEvent.timeUpdate(video);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]).toEqual({ state: 'playing', positionMs: 2_500 });
  });

  it('observes nothing while playback observation is disabled', () => {
    const onPlaybackSnapshot = vi.fn();
    renderUploadPlayer({ playbackObservationEnabled: false, onPlaybackSnapshot });
    const video = getVideo();
    stubMediaElement(video);

    fireEvent.loadedMetadata(video);
    fireEvent.timeUpdate(video);

    expect(onPlaybackSnapshot).not.toHaveBeenCalled();
  });
});

describe('Upload media seeking and pending commands', () => {
  it('converts milliseconds only at the adapter boundary and plays after an exact ready seek', () => {
    const ref = createRef<MediaPlayerHandle>();
    renderUploadPlayer({ ref });
    const video = getVideo();
    const media = stubMediaElement(video);
    fireEvent.loadedMetadata(video);

    act(() => {
      ref.current?.seekToMs(4_250);
      ref.current?.play();
    });

    expect(media.readCurrentTime()).toBe(4.25);
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  it('seeks exactly to the start of the first segment', () => {
    const ref = createRef<MediaPlayerHandle>();
    renderUploadPlayer({ ref });
    const video = getVideo();
    const media = stubMediaElement(video);
    media.setCurrentTime(12);
    fireEvent.loadedMetadata(video);

    act(() => ref.current?.seekToMs(0));

    expect(media.readCurrentTime()).toBe(0);
  });

  it('retains only the latest pre-metadata command and applies it once', () => {
    const ref = createRef<MediaPlayerHandle>();
    renderUploadPlayer({ ref });
    const video = getVideo();
    const media = stubMediaElement(video);

    act(() => {
      ref.current?.seekToMs(0);
      ref.current?.play();
      ref.current?.seekToMs(7_500);
      ref.current?.play();
    });
    expect(media.readCurrentTime()).toBe(0);
    expect(media.play).not.toHaveBeenCalled();

    fireEvent.loadedMetadata(video);
    fireEvent.canPlay(video);

    expect(media.readCurrentTime()).toBe(7.5);
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  it('ignores non-finite and negative seek requests', () => {
    const ref = createRef<MediaPlayerHandle>();
    renderUploadPlayer({ ref });
    const video = getVideo();
    const media = stubMediaElement(video);
    fireEvent.loadedMetadata(video);

    act(() => {
      ref.current?.seekToMs(Number.NaN);
      ref.current?.seekToMs(-500);
    });

    expect(media.readCurrentTime()).toBe(0);
  });

  it('clears a pending command on Asset change, on error, and on unmount', () => {
    const ref = createRef<MediaPlayerHandle>();
    const view = renderUploadPlayer({ ref, assetId: 'asset-one' });
    const firstVideo = getVideo();
    stubMediaElement(firstVideo);
    act(() => {
      ref.current?.seekToMs(9_000);
      ref.current?.play();
    });

    view.rerender(
      <UploadMediaPlayer ref={ref} assetId="asset-two" title="Uploaded lecture" />,
    );
    const secondVideo = getVideo();
    const secondMedia = stubMediaElement(secondVideo);
    expect(secondVideo).toHaveAttribute('src', '/api/assets/asset-two/media');

    fireEvent.loadedMetadata(secondVideo);
    expect(secondMedia.readCurrentTime()).toBe(0);
    expect(secondMedia.play).not.toHaveBeenCalled();

    view.rerender(
      <UploadMediaPlayer ref={ref} assetId="asset-three" title="Uploaded lecture" />,
    );
    const thirdVideo = getVideo();
    const thirdMedia = stubMediaElement(thirdVideo);
    act(() => {
      ref.current?.seekToMs(3_000);
      ref.current?.play();
    });
    fireEvent.error(thirdVideo);
    fireEvent.loadedMetadata(thirdVideo);
    expect(thirdMedia.readCurrentTime()).toBe(0);
    expect(thirdMedia.play).not.toHaveBeenCalled();

    view.rerender(
      <UploadMediaPlayer ref={ref} assetId="asset-four" title="Uploaded lecture" />,
    );
    const fourthVideo = getVideo();
    const fourthMedia = stubMediaElement(fourthVideo);
    act(() => {
      ref.current?.seekToMs(5_000);
      ref.current?.play();
    });

    view.unmount();

    expect(ref.current).toBeNull();
    expect(fourthMedia.readCurrentTime()).toBe(0);
    expect(fourthMedia.play).not.toHaveBeenCalled();
  });

  it('keeps a rejected play promise non-fatal and free of browser exception text', async () => {
    const ref = createRef<MediaPlayerHandle>();
    renderUploadPlayer({ ref });
    const video = getVideo();
    stubMediaElement(video, () => Promise.reject(new Error('NotAllowedError: gesture required')));
    fireEvent.loadedMetadata(video);

    await act(async () => {
      ref.current?.play();
      await Promise.resolve();
    });

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(
      'Playback did not start. Use the video controls to start playing.',
    );
    expect(notice).not.toHaveTextContent(/NotAllowed|Error|gesture/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps a synchronously throwing play call non-fatal', () => {
    const ref = createRef<MediaPlayerHandle>();
    renderUploadPlayer({ ref });
    const video = getVideo();
    stubMediaElement(video, () => {
      throw new Error('Not implemented');
    });
    fireEvent.loadedMetadata(video);

    act(() => ref.current?.play());

    expect(screen.getByRole('status')).toHaveTextContent(
      'Playback did not start. Use the video controls to start playing.',
    );
  });
});

describe('Upload media error behavior', () => {
  it('announces bounded error copy, clears playback and hides no browser detail', () => {
    const snapshots: MediaPlaybackSnapshot[] = [];
    renderUploadPlayer({
      playbackObservationEnabled: true,
      onPlaybackSnapshot: (snapshot) => snapshots.push(snapshot),
    });
    const video = getVideo();
    const media = stubMediaElement(video);
    fireEvent.loadedMetadata(video);
    media.setPaused(false);
    media.setCurrentTime(6);
    fireEvent.playing(video);

    fireEvent.error(video);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The uploaded video could not be played.');
    expect(alert).toHaveTextContent('You can keep reading the transcript.');
    expect(alert).not.toHaveTextContent(/MEDIA_ERR|code|minio|bucket|http|stack/i);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'error', positionMs: null });
  });
});
