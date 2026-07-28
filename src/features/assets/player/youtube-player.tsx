import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { SourceBadge } from '../components/source-badge';
import {
  loadYouTubeIframeApi,
  type YouTubePlayerInstance,
} from './youtube-iframe-api';

export type MediaPlayerHandle = {
  seekToMs(timeMs: number): void;
  play(): void;
};

export type MediaPlayerState = 'idle' | 'loading-api' | 'creating-player' | 'ready' | 'error';

type PendingPlayerCommand = {
  seekMs: number;
  shouldPlay: boolean;
};

const PLAYER_STATE_LABELS: Record<MediaPlayerState, string> = {
  idle: 'Preparing player',
  'loading-api': 'Loading player',
  'creating-player': 'Creating player',
  ready: 'Ready',
  error: 'Unavailable',
};

function configurePlayerIframe(iframe: HTMLIFrameElement, title: string) {
  iframe.title = `${title} YouTube player`;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.setAttribute(
    'allow',
    'autoplay; encrypted-media; picture-in-picture; fullscreen',
  );
  iframe.setAttribute('allowfullscreen', '');
}

export const YouTubePlayer = forwardRef<MediaPlayerHandle, {
  videoId: string;
  title: string;
  sourceUrl: string | null;
}>(function YouTubePlayer({ videoId, title, sourceUrl }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const playerReadyRef = useRef(false);
  const pendingCommandRef = useRef<PendingPlayerCommand | null>(null);
  const titleRef = useRef(title);
  const [playerState, setPlayerState] = useState<MediaPlayerState>('idle');
  titleRef.current = title;

  useImperativeHandle(ref, () => ({
    seekToMs(timeMs) {
      if (!Number.isFinite(timeMs) || timeMs < 0) return;

      if (playerReadyRef.current && playerRef.current) {
        playerRef.current.seekTo(timeMs / 1_000, true);
        return;
      }

      pendingCommandRef.current = { seekMs: timeMs, shouldPlay: false };
    },
    play() {
      if (playerReadyRef.current && playerRef.current) {
        playerRef.current.playVideo();
        return;
      }

      if (pendingCommandRef.current) {
        pendingCommandRef.current = {
          ...pendingCommandRef.current,
          shouldPlay: true,
        };
      }
    },
  }), []);

  useEffect(() => {
    let disposed = false;
    let ownedPlayer: YouTubePlayerInstance | null = null;
    const host = hostRef.current;

    playerReadyRef.current = false;
    pendingCommandRef.current = null;
    playerRef.current = null;
    setPlayerState('loading-api');

    void loadYouTubeIframeApi()
      .then((api) => {
        if (disposed || !host) return;

        setPlayerState('creating-player');
        const mount = document.createElement('div');
        host.replaceChildren(mount);

        const origin = window.location.origin.startsWith('http')
          ? window.location.origin
          : undefined;
        ownedPlayer = new api.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: 0,
            controls: 1,
            fs: 1,
            playsinline: 1,
            rel: 0,
            ...(origin ? { origin } : {}),
          },
          events: {
            onReady: (event) => {
              if (disposed || event.target !== ownedPlayer) return;

              configurePlayerIframe(event.target.getIframe(), titleRef.current);

              playerRef.current = event.target;
              playerReadyRef.current = true;
              setPlayerState('ready');

              const pendingCommand = pendingCommandRef.current;
              pendingCommandRef.current = null;
              if (!pendingCommand) return;

              event.target.seekTo(pendingCommand.seekMs / 1_000, true);
              if (pendingCommand.shouldPlay) event.target.playVideo();
            },
            onError: () => {
              if (disposed) return;
              playerReadyRef.current = false;
              pendingCommandRef.current = null;
              setPlayerState('error');
            },
          },
        });
        playerRef.current = ownedPlayer;
        configurePlayerIframe(ownedPlayer.getIframe(), titleRef.current);
      })
      .catch(() => {
        if (!disposed) setPlayerState('error');
      });

    return () => {
      disposed = true;
      playerReadyRef.current = false;
      pendingCommandRef.current = null;
      playerRef.current = null;
      ownedPlayer?.destroy();
      host?.replaceChildren();
    };
  }, [videoId]);

  useEffect(() => {
    if (!playerReadyRef.current || !playerRef.current) return;
    configurePlayerIframe(playerRef.current.getIframe(), title);
  }, [title]);

  const isLoading = playerState === 'idle'
    || playerState === 'loading-api'
    || playerState === 'creating-player';

  return (
    <section
      className={`youtube-player youtube-player--${playerState}`}
      aria-label={`YouTube player for ${title}`}
      data-player-state={playerState}
    >
      <div className="youtube-player__header">
        <div className="youtube-player__identity">
          <SourceBadge sourceType="YOUTUBE" />
          <span className="youtube-player__state" aria-live="polite">
            {PLAYER_STATE_LABELS[playerState]}
          </span>
        </div>
        {sourceUrl ? (
          <a
            className="external-source-link"
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on YouTube <span className="visually-hidden">(opens in a new tab)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        ) : null}
      </div>

      <div className="youtube-player__viewport">
        <div ref={hostRef} className="youtube-player__host" />
        {isLoading ? (
          <div className="youtube-player__message" role="status" aria-live="polite">
            Loading YouTube player…
          </div>
        ) : null}
        {playerState === 'error' ? (
          <div className="youtube-player__message" role="alert">
            <strong>The YouTube player could not be loaded.</strong>
            <span>You can keep reading the transcript or open the video on YouTube.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
});
