import { createRef } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetYouTubeIframeApiLoaderForTests,
  YOUTUBE_IFRAME_API_SCRIPT_ID,
  type YouTubeIframeApi,
  type YouTubePlayerInstance,
  type YouTubePlayerOptions,
} from './youtube-iframe-api';
import { YouTubePlayer, type MediaPlayerHandle } from './youtube-player';

type MockPlayer = Omit<YouTubePlayerInstance, 'seekTo' | 'playVideo' | 'destroy'> & {
  options: YouTubePlayerOptions;
  iframe: HTMLIFrameElement;
  seekTo: ReturnType<typeof vi.fn>;
  playVideo: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
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
});

describe('YouTube player adapter', () => {
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
    render(
      <YouTubePlayer
        videoId="video-a"
        title="Video A"
        sourceUrl="https://www.youtube.com/watch?v=video-a"
      />,
    );
    await waitFor(() => expect(players).toHaveLength(1));

    players[0].options.events.onError();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The YouTube player could not be loaded.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(/provider|stack|object/i);
    expect(screen.getByRole('link', { name: /open on youtube/i })).toBeInTheDocument();
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
});
