import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { useTranslation } from '../../../shared/i18n';
import { SourceBadge } from '../components/source-badge';
import {
  toPlaybackPositionMs,
  type MediaPlaybackSnapshot,
  type MediaPlaybackState,
  type MediaPlayerHandle,
} from './media-player';
import {
  loadYouTubeIframeApi,
  type YouTubePlayerInstance,
} from './youtube-iframe-api';

export type MediaPlayerState = 'idle' | 'loading-api' | 'creating-player' | 'ready' | 'error';
export const PLAYBACK_POSITION_POLL_INTERVAL_MS = 250;

type PendingPlayerCommand = {
  seekMs: number;
  shouldPlay: boolean;
  keepPaused: boolean;
};

/** `viewer.player` keys for the surface state; the words live in the translation resources. */
const PLAYER_STATE_LABEL_KEYS = {
  idle: 'player.idle',
  'loading-api': 'player.loadingApi',
  'creating-player': 'player.creatingPlayer',
  ready: 'player.ready',
  error: 'player.unavailable',
} as const satisfies Record<MediaPlayerState, string>;

function configurePlayerIframe(iframe: HTMLIFrameElement, iframeTitle: string) {
  iframe.title = iframeTitle;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.setAttribute(
    'allow',
    'autoplay; encrypted-media; picture-in-picture; fullscreen',
  );
  iframe.setAttribute('allowfullscreen', '');
}

export function mapYouTubePlaybackState(state: number): MediaPlaybackState {
  if (state === 1) return 'playing';
  if (state === 2) return 'paused';
  if (state === 3) return 'buffering';
  if (state === 0) return 'ended';
  if (state === 5) return 'cued';
  return 'unstarted';
}

export function readYouTubePositionMs(player: YouTubePlayerInstance): number | null {
  return toPlaybackPositionMs(player.getCurrentTime());
}

/**
 * Positions this provider at a moment without starting playback.
 *
 * The provider's own seek contract keeps a paused video paused but starts playing when it is
 * seeked from any other state, including a video that has never been played. Cueing the same
 * video at the moment is the provider's documented way to prepare that position silently, so the
 * provider's own play control also starts from the selected moment.
 */
function positionYouTubeWithoutPlayback(
  player: YouTubePlayerInstance,
  videoId: string,
  timeMs: number,
): void {
  const startSeconds = timeMs / 1_000;
  const playbackState = mapYouTubePlaybackState(player.getPlayerState());

  if (playbackState === 'unstarted' || playbackState === 'cued') {
    player.cueVideoById({ videoId, startSeconds });
    return;
  }

  player.seekTo(startSeconds, true);
  if (playbackState !== 'playing' && playbackState !== 'buffering') player.pauseVideo();
}

export const YouTubePlayer = forwardRef<MediaPlayerHandle, {
  videoId: string;
  title: string;
  sourceUrl: string | null;
  playbackObservationEnabled?: boolean;
  regionRef?: Ref<HTMLElement>;
  onPlaybackSnapshot?: (snapshot: MediaPlaybackSnapshot) => void;
}>(function YouTubePlayer({
  videoId,
  title,
  sourceUrl,
  playbackObservationEnabled = false,
  regionRef,
  onPlaybackSnapshot,
}, ref) {
  const { t } = useTranslation('viewer');
  // The iframe's accessible title is set imperatively on a provider-owned element, so the
  // translated string is mirrored into a ref for the callbacks that run outside render.
  const iframeTitle = t('player.youtubeIframeTitle', { title });
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const playerReadyRef = useRef(false);
  const pendingCommandRef = useRef<PendingPlayerCommand | null>(null);
  const iframeTitleRef = useRef(iframeTitle);
  const videoIdRef = useRef(videoId);
  const observationEnabledRef = useRef(playbackObservationEnabled);
  const snapshotListenerRef = useRef(onPlaybackSnapshot);
  const refreshObservationRef = useRef<() => void>(() => undefined);
  const [playerState, setPlayerState] = useState<MediaPlayerState>('idle');
  iframeTitleRef.current = iframeTitle;
  videoIdRef.current = videoId;
  observationEnabledRef.current = playbackObservationEnabled;
  snapshotListenerRef.current = onPlaybackSnapshot;

  useImperativeHandle(ref, () => ({
    seekToMs(timeMs, options) {
      if (!Number.isFinite(timeMs) || timeMs < 0) return;

      const keepPaused = options?.keepPaused === true;

      if (playerReadyRef.current && playerRef.current) {
        if (keepPaused) {
          positionYouTubeWithoutPlayback(playerRef.current, videoIdRef.current, timeMs);
          return;
        }

        playerRef.current.seekTo(timeMs / 1_000, true);
        return;
      }

      pendingCommandRef.current = { seekMs: timeMs, shouldPlay: false, keepPaused };
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
          keepPaused: false,
        };
      }
    },
  }), []);

  useEffect(() => {
    let disposed = false;
    let ownedPlayer: YouTubePlayerInstance | null = null;
    let playbackState: MediaPlaybackState = 'unstarted';
    let pollingIntervalId: number | null = null;
    const host = hostRef.current;

    function stopPolling() {
      if (pollingIntervalId === null) return;
      window.clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }

    function emitSnapshot(positionMs: number | null) {
      if (!observationEnabledRef.current) return;
      snapshotListenerRef.current?.({ state: playbackState, positionMs });
    }

    function samplePosition() {
      if (!ownedPlayer || disposed || !playerReadyRef.current) return;
      emitSnapshot(readYouTubePositionMs(ownedPlayer));
    }

    function playbackNeedsPolling() {
      return playbackState === 'playing' || playbackState === 'buffering';
    }

    function refreshObservation() {
      stopPolling();
      if (
        !observationEnabledRef.current ||
        !playerReadyRef.current ||
        !ownedPlayer ||
        !playbackNeedsPolling() ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }

      samplePosition();
      pollingIntervalId = window.setInterval(
        samplePosition,
        PLAYBACK_POSITION_POLL_INTERVAL_MS,
      );
    }

    function destroyOwnedPlayer() {
      const player = ownedPlayer;
      if (!player) return;
      ownedPlayer = null;
      if (playerRef.current === player) playerRef.current = null;
      try {
        player.destroy();
      } catch {
        // Provider cleanup failures must not break the surrounding Study UI.
      }
      host?.replaceChildren();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stopPolling();
        return;
      }
      refreshObservation();
    }

    playerReadyRef.current = false;
    pendingCommandRef.current = null;
    playerRef.current = null;
    setPlayerState('loading-api');
    refreshObservationRef.current = refreshObservation;
    document.addEventListener('visibilitychange', handleVisibilityChange);

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

              configurePlayerIframe(event.target.getIframe(), iframeTitleRef.current);

              playerRef.current = event.target;
              playerReadyRef.current = true;
              setPlayerState('ready');
              playbackState = mapYouTubePlaybackState(event.target.getPlayerState());
              if (observationEnabledRef.current) {
                emitSnapshot(readYouTubePositionMs(event.target));
              }
              refreshObservation();

              const pendingCommand = pendingCommandRef.current;
              pendingCommandRef.current = null;
              if (!pendingCommand) return;

              if (pendingCommand.keepPaused) {
                positionYouTubeWithoutPlayback(event.target, videoId, pendingCommand.seekMs);
                return;
              }

              event.target.seekTo(pendingCommand.seekMs / 1_000, true);
              if (pendingCommand.shouldPlay) event.target.playVideo();
            },
            onStateChange: (event) => {
              if (disposed || event.target !== ownedPlayer) return;
              playbackState = mapYouTubePlaybackState(event.data);
              if (!playerReadyRef.current) return;
              if (observationEnabledRef.current) {
                emitSnapshot(readYouTubePositionMs(event.target));
              }
              refreshObservation();
            },
            onError: () => {
              if (disposed) return;
              playerReadyRef.current = false;
              pendingCommandRef.current = null;
              playbackState = 'error';
              stopPolling();
              snapshotListenerRef.current?.({ state: 'error', positionMs: null });
              setPlayerState('error');
              destroyOwnedPlayer();
            },
          },
        });
        playerRef.current = ownedPlayer;
        configurePlayerIframe(ownedPlayer.getIframe(), iframeTitleRef.current);
      })
      .catch(() => {
        if (disposed) return;
        playerReadyRef.current = false;
        pendingCommandRef.current = null;
        playbackState = 'error';
        stopPolling();
        snapshotListenerRef.current?.({ state: 'error', positionMs: null });
        setPlayerState('error');
        destroyOwnedPlayer();
      });

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
      refreshObservationRef.current = () => undefined;
      playerReadyRef.current = false;
      pendingCommandRef.current = null;
      playerRef.current = null;
      destroyOwnedPlayer();
    };
  }, [videoId]);

  useEffect(() => {
    refreshObservationRef.current();
  }, [playbackObservationEnabled]);

  useEffect(() => {
    if (!playerReadyRef.current || !playerRef.current) return;
    configurePlayerIframe(playerRef.current.getIframe(), iframeTitle);
  }, [iframeTitle]);

  const isLoading = playerState === 'idle'
    || playerState === 'loading-api'
    || playerState === 'creating-player';

  return (
    <section
      ref={regionRef}
      tabIndex={-1}
      className={`youtube-player youtube-player--${playerState}`}
      aria-label={t('player.youtubeRegionLabel', { title })}
      data-player-state={playerState}
    >
      <div className="youtube-player__header">
        <div className="youtube-player__identity">
          <SourceBadge sourceType="YOUTUBE" />
          <span className="youtube-player__state" aria-live="polite">
            {t(PLAYER_STATE_LABEL_KEYS[playerState])}
          </span>
        </div>
        {sourceUrl ? (
          <a
            className="external-source-link"
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('details.openOnYouTube')} <span className="visually-hidden">{t('details.opensInNewTab')}</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        ) : null}
      </div>

      <div className="youtube-player__viewport">
        <div ref={hostRef} className="youtube-player__host" />
        {isLoading ? (
          <div className="youtube-player__message" role="status" aria-live="polite">
            {t('player.loadingYouTube')}
          </div>
        ) : null}
        {playerState === 'error' ? (
          <div className="youtube-player__message" role="alert">
            <strong>{t('player.youtubeErrorTitle')}</strong>
            <span>{t('player.youtubeErrorMessage')}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
});
