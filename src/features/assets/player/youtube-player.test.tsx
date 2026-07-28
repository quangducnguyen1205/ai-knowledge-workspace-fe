import { createRef } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetYouTubeIframeApiLoaderForTests,
  YOUTUBE_IFRAME_API_SCRIPT_ID,
  type YouTubeIframeApi,
  type YouTubePlayerInstance,
  type YouTubePlayerOptions,
} from './youtube-iframe-api';
import {
  mapYouTubePlaybackState,
  PLAYBACK_POSITION_POLL_INTERVAL_MS,
  readYouTubePositionMs,
  YouTubePlayer,
  type MediaPlaybackSnapshot,
  type MediaPlayerHandle,
} from './youtube-player';

type MockPlayer = Omit<YouTubePlayerInstance, 'seekTo' | 'playVideo' | 'destroy'> & {
  options: YouTubePlayerOptions;
  iframe: HTMLIFrameElement;
  seekTo: ReturnType<typeof vi.fn>;
  playVideo: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  getCurrentTime: ReturnType<typeof vi.fn>;
  getPlayerState: ReturnType<typeof vi.fn>;
};

function installPlayerApi() {
  const players: MockPlayer[] = [];
  const Player = vi.fn(function Player(element: HTMLElement, options: YouTubePlayerOptions) {
    const iframe = document.createElement('iframe');
    element.replaceWith(iframe);
    const player: MockPlayer = {
      options,
      iframe,
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getPlayerState: vi.fn(() => -1),
      getIframe: () => iframe,
    };
    players.push(player);
    return player;
  });
  window.YT = { Player } as unknown as YouTubeIframeApi;
  return { Player, players };
}

function ready(player: MockPlayer) {
  player.options.events.onReady({ target: player });
}

afterEach(() => {
  cleanup();
  resetYouTubeIframeApiLoaderForTests();
  document.getElementById(YOUTUBE_IFRAME_API_SCRIPT_ID)?.remove();
  Reflect.deleteProperty(window, 'YT');
  Reflect.deleteProperty(window, 'onYouTubeIframeAPIReady');
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
});

describe('YouTube player adapter', () => {
  it.each([
    [-1, 'unstarted'],
    [0, 'ended'],
    [1, 'playing'],
    [2, 'paused'],
    [3, 'buffering'],
    [5, 'cued'],
    [99, 'unstarted'],
  ] as const)('maps provider state %s to neutral state %s', (rawState, expected) => {
    expect(mapYouTubePlaybackState(rawState)).toBe(expected);
  });

  it('floors provider seconds to integer milliseconds and rejects invalid positions', () => {
    const { players } = installPlayerApi();
    render(<YouTubePlayer videoId="video-a" title="Video A" sourceUrl={null} />);

    return waitFor(() => expect(players).toHaveLength(1)).then(() => {
      players[0].getCurrentTime.mockReturnValue(1.2349);
      expect(readYouTubePositionMs(players[0])).toBe(1_234);
      players[0].getCurrentTime.mockReturnValue(Number.NaN);
      expect(readYouTubePositionMs(players[0])).toBeNull();
      players[0].getCurrentTime.mockReturnValue(-1);
      expect(readYouTubePositionMs(players[0])).toBeNull();
    });
  });

  it('creates the exact video, represents readiness, and applies intentional iframe policy', async () => {
    const { Player, players } = installPlayerApi();
    render(
      <YouTubePlayer
        videoId="abc_DEF-123"
        title="Causal ordering"
        sourceUrl="https://www.youtube.com/watch?v=abc_DEF-123"
      />,
    );

    expect(await screen.findByText('Loading YouTube player…')).toBeInTheDocument();
    await waitFor(() => expect(Player).toHaveBeenCalledTimes(1));
    expect(Player.mock.calls[0]?.[1]).toMatchObject({
      videoId: 'abc_DEF-123',
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        autoplay: 0,
        controls: 1,
        fs: 1,
        playsinline: 1,
        rel: 0,
      },
    });

    ready(players[0]);

    await waitFor(() => expect(screen.getByText('Ready')).toBeInTheDocument());
    expect(players[0].iframe).toHaveAttribute('title', 'Causal ordering YouTube player');
    expect(players[0].iframe).toHaveAttribute(
      'allow',
      'autoplay; encrypted-media; picture-in-picture; fullscreen',
    );
    expect(players[0].iframe).not.toHaveAttribute('allow', expect.stringMatching(/camera|microphone|geolocation|clipboard/i));
    expect(screen.getByRole('link', { name: /open on youtube/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('converts milliseconds only at the provider boundary and plays after an exact ready seek', async () => {
    const { players } = installPlayerApi();
    const ref = createRef<MediaPlayerHandle>();
    render(
      <YouTubePlayer
        ref={ref}
        videoId="video-a"
        title="Video A"
        sourceUrl={null}
      />,
    );
    await waitFor(() => expect(players).toHaveLength(1));
    ready(players[0]);

    ref.current?.seekToMs(4_250);
    ref.current?.play();

    expect(players[0].seekTo).toHaveBeenCalledWith(4.25, true);
    expect(players[0].playVideo).toHaveBeenCalledTimes(1);
    expect(players[0].seekTo.mock.invocationCallOrder[0])
      .toBeLessThan(players[0].playVideo.mock.invocationCallOrder[0]);
  });

  it('stores only the latest pre-ready seek and applies it once when ready', async () => {
    const { players } = installPlayerApi();
    const ref = createRef<MediaPlayerHandle>();
    render(
      <YouTubePlayer
        ref={ref}
        videoId="video-a"
        title="Video A"
        sourceUrl={null}
      />,
    );
    await waitFor(() => expect(players).toHaveLength(1));

    ref.current?.seekToMs(0);
    ref.current?.play();
    ref.current?.seekToMs(7_500);
    ref.current?.play();
    expect(players[0].seekTo).not.toHaveBeenCalled();

    ready(players[0]);
    ready(players[0]);

    expect(players[0].seekTo).toHaveBeenCalledTimes(1);
    expect(players[0].seekTo).toHaveBeenCalledWith(7.5, true);
    expect(players[0].playVideo).toHaveBeenCalledTimes(1);
  });

  it('destroys the old instance, clears pending seek, and creates a new video on source change', async () => {
    const { Player, players } = installPlayerApi();
    const ref = createRef<MediaPlayerHandle>();
    const view = render(
      <YouTubePlayer ref={ref} videoId="video-a" title="Video A" sourceUrl={null} />,
    );
    await waitFor(() => expect(players).toHaveLength(1));
    ref.current?.seekToMs(9_000);
    ref.current?.play();

    view.rerender(
      <YouTubePlayer ref={ref} videoId="video-b" title="Video B" sourceUrl={null} />,
    );

    await waitFor(() => expect(Player).toHaveBeenCalledTimes(2));
    expect(players[0].destroy).toHaveBeenCalledTimes(1);
    expect(Player.mock.calls[1]?.[1].videoId).toBe('video-b');
    ready(players[1]);
    expect(players[1].seekTo).not.toHaveBeenCalled();

    view.unmount();
    expect(players[1].destroy).toHaveBeenCalledTimes(1);
  });

  it('uses bounded provider-error copy without throwing away the external fallback', async () => {
    const { players } = installPlayerApi();
    const ref = createRef<MediaPlayerHandle>();
    render(
      <YouTubePlayer
        ref={ref}
        videoId="video-a"
        title="Video A"
        sourceUrl="https://www.youtube.com/watch?v=video-a"
      />,
    );
    await waitFor(() => expect(players).toHaveLength(1));
    ref.current?.seekToMs(8_000);
    ref.current?.play();

    players[0].options.events.onError();
    ready(players[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The YouTube player could not be loaded.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(/provider|stack|object/i);
    expect(screen.getByRole('link', { name: /open on youtube/i })).toBeInTheDocument();
    expect(players[0].destroy).toHaveBeenCalledTimes(1);
    expect(players[0].iframe.isConnected).toBe(false);
    expect(players[0].seekTo).not.toHaveBeenCalled();
    expect(players[0].playVideo).not.toHaveBeenCalled();

    cleanup();
    expect(players[0].destroy).toHaveBeenCalledTimes(1);
  });

  it('announces a bounded unavailable state when the API script fails', async () => {
    render(
      <YouTubePlayer
        videoId="video-a"
        title="Video A"
        sourceUrl="https://www.youtube.com/watch?v=video-a"
      />,
    );
    const script = await waitFor(() => {
      const candidate = document.getElementById(YOUTUBE_IFRAME_API_SCRIPT_ID);
      expect(candidate).toBeInstanceOf(HTMLScriptElement);
      return candidate as HTMLScriptElement;
    });

    script.dispatchEvent(new Event('error'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The YouTube player could not be loaded.',
    );
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('destroys only the removed instance when another mounted player remains', async () => {
    const { players } = installPlayerApi();
    const view = render(
      <>
        <YouTubePlayer key="video-a" videoId="video-a" title="Video A" sourceUrl={null} />
        <YouTubePlayer key="video-b" videoId="video-b" title="Video B" sourceUrl={null} />
      </>,
    );
    await waitFor(() => expect(players).toHaveLength(2));

    view.rerender(
      <YouTubePlayer key="video-b" videoId="video-b" title="Video B" sourceUrl={null} />,
    );

    expect(players[0].destroy).toHaveBeenCalledTimes(1);
    expect(players[1].destroy).not.toHaveBeenCalled();
    ready(players[1]);
    expect(await screen.findByText('Ready')).toBeInTheDocument();
  });

  it('polls one loop only while playing or buffering and stops on pause, ended, error, and unmount', async () => {
    vi.useFakeTimers();
    const snapshots: MediaPlaybackSnapshot[] = [];
    const { players } = installPlayerApi();
    const view = render(
      <YouTubePlayer
        videoId="video-a"
        title="Video A"
        sourceUrl={null}
        playbackObservationEnabled
        onPlaybackSnapshot={(snapshot) => snapshots.push(snapshot)}
      />,
    );
    await act(async () => Promise.resolve());
    expect(players).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);

    players[0].getPlayerState.mockReturnValue(1);
    players[0].getCurrentTime.mockReturnValue(1.2349);
    act(() => ready(players[0]));
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'playing', positionMs: 1_234 });
    expect(vi.getTimerCount()).toBe(1);

    act(() => players[0].options.events.onStateChange({ target: players[0], data: 3 }));
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(PLAYBACK_POSITION_POLL_INTERVAL_MS));
    expect(snapshots[snapshots.length - 1]?.state).toBe('buffering');

    act(() => players[0].options.events.onStateChange({ target: players[0], data: 2 }));
    expect(vi.getTimerCount()).toBe(0);
    act(() => players[0].options.events.onStateChange({ target: players[0], data: 1 }));
    expect(vi.getTimerCount()).toBe(1);
    act(() => players[0].options.events.onStateChange({ target: players[0], data: 0 }));
    expect(vi.getTimerCount()).toBe(0);

    act(() => players[0].options.events.onStateChange({ target: players[0], data: 1 }));
    expect(vi.getTimerCount()).toBe(1);
    act(() => players[0].options.events.onError());
    expect(vi.getTimerCount()).toBe(0);
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'error', positionMs: null });

    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops while hidden and performs an immediate read before resuming one visible loop', async () => {
    vi.useFakeTimers();
    const snapshots: MediaPlaybackSnapshot[] = [];
    const { players } = installPlayerApi();
    render(
      <YouTubePlayer
        videoId="video-a"
        title="Video A"
        sourceUrl={null}
        playbackObservationEnabled
        onPlaybackSnapshot={(snapshot) => snapshots.push(snapshot)}
      />,
    );
    await act(async () => Promise.resolve());
    players[0].getPlayerState.mockReturnValue(1);
    act(() => ready(players[0]));
    expect(vi.getTimerCount()).toBe(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(vi.getTimerCount()).toBe(0);

    const countBeforeRestore = snapshots.length;
    players[0].getCurrentTime.mockReturnValue(8.5);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(snapshots).toHaveLength(countBeforeRestore + 1);
    expect(snapshots[snapshots.length - 1]).toEqual({ state: 'playing', positionMs: 8_500 });
    expect(vi.getTimerCount()).toBe(1);
  });

  it('starts observation when timed rows arrive and clears the old loop on video change', async () => {
    vi.useFakeTimers();
    const snapshots: MediaPlaybackSnapshot[] = [];
    const { players } = installPlayerApi();
    const view = render(
      <YouTubePlayer
        videoId="video-a"
        title="Video A"
        sourceUrl={null}
        playbackObservationEnabled={false}
        onPlaybackSnapshot={(snapshot) => snapshots.push(snapshot)}
      />,
    );
    await act(async () => Promise.resolve());
    players[0].getPlayerState.mockReturnValue(1);
    act(() => ready(players[0]));
    expect(vi.getTimerCount()).toBe(0);
    expect(snapshots).toHaveLength(0);

    view.rerender(
      <YouTubePlayer
        videoId="video-a"
        title="Video A"
        sourceUrl={null}
        playbackObservationEnabled
        onPlaybackSnapshot={(snapshot) => snapshots.push(snapshot)}
      />,
    );
    expect(vi.getTimerCount()).toBe(1);
    expect(snapshots).toHaveLength(1);

    view.rerender(
      <YouTubePlayer
        videoId="video-b"
        title="Video B"
        sourceUrl={null}
        playbackObservationEnabled
        onPlaybackSnapshot={(snapshot) => snapshots.push(snapshot)}
      />,
    );
    await act(async () => Promise.resolve());
    expect(players[0].destroy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(players).toHaveLength(2);
  });
});
