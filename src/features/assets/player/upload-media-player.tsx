import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { resolveAuthMode, type AuthMode } from '../../../lib/auth-config';
import { buildAssetMediaUrl } from '../api/assets-api';
import { SourceBadge } from '../components/source-badge';
import {
  toPlaybackPositionMs,
  type MediaPlaybackSnapshot,
  type MediaPlaybackState,
  type MediaPlayerHandle,
} from './media-player';

export type UploadMediaSurfaceState = 'loading' | 'ready' | 'error';

/**
 * Browser media events this adapter observes. Raw browser event names never leave this
 * module; Study consumes only provider-neutral playback snapshots.
 */
export type HtmlMediaEventType =
  | 'loadstart'
  | 'loadedmetadata'
  | 'canplay'
  | 'playing'
  | 'pause'
  | 'ended'
  | 'waiting'
  | 'stalled'
  | 'seeking'
  | 'seeked'
  | 'timeupdate'
  | 'error';

export type HtmlMediaElementSnapshot = {
  paused: boolean;
  ended: boolean;
  currentTime: number;
};

type PendingPlayerCommand = {
  seekMs: number;
  shouldPlay: boolean;
};

const SURFACE_STATE_LABELS: Record<UploadMediaSurfaceState, string> = {
  loading: 'Loading',
  ready: 'Ready',
  error: 'Unavailable',
};

export const UPLOAD_MEDIA_LOADING_COPY = 'Loading video…';

export const UPLOAD_MEDIA_ERROR_COPY = {
  title: 'The uploaded video could not be played.',
  message: 'You can keep reading the transcript.',
};

export const UPLOAD_MEDIA_UNSUPPORTED_AUTH_COPY = {
  title: 'Upload playback is not available in this authentication mode yet.',
  message: 'The transcript and other Study tools remain available.',
};

export const UPLOAD_MEDIA_PLAYBACK_BLOCKED_COPY =
  'Playback did not start. Use the video controls to start playing.';

/**
 * A native media element cannot attach an in-memory bearer token to its own request, so
 * Upload playback is offered only where the established browser credential already applies
 * to a plain media request. Legacy session mode uses the authenticated cookie the rest of
 * the product already relies on; bearer mode has no native-media delivery yet.
 */
export function supportsNativeMediaPlayback(mode: AuthMode = resolveAuthMode()): boolean {
  return mode === 'legacy_session';
}

export function mapHtmlMediaPlaybackState(
  eventType: HtmlMediaEventType,
  element: HtmlMediaElementSnapshot,
): MediaPlaybackState {
  if (eventType === 'error') return 'error';
  if (eventType === 'loadstart') return 'unstarted';
  if (eventType === 'ended' || element.ended) return 'ended';
  if (eventType === 'waiting' || eventType === 'stalled') return 'buffering';
  if (eventType === 'playing') return 'playing';
  if (eventType === 'pause') return 'paused';
  if (eventType === 'seeking' && !element.paused) return 'buffering';
  if (eventType === 'loadedmetadata' || eventType === 'canplay') {
    if (!element.paused) return 'playing';
    return element.currentTime > 0 ? 'paused' : 'cued';
  }
  return element.paused ? 'paused' : 'playing';
}

export function readHtmlMediaPositionMs(element: HtmlMediaElementSnapshot): number | null {
  return toPlaybackPositionMs(element.currentTime);
}

function seekMediaElement(element: HTMLMediaElement, timeMs: number) {
  try {
    element.currentTime = timeMs / 1_000;
  } catch {
    // A rejected seek must not break Study; native controls remain usable.
  }
}

function startMediaPlayback(element: HTMLMediaElement, onBlocked: () => void) {
  try {
    const started: unknown = element.play();
    if (started && typeof (started as Promise<void>).then === 'function') {
      void (started as Promise<void>).then(() => undefined, onBlocked);
    }
  } catch {
    onBlocked();
  }
}

export const UploadMediaPlayer = forwardRef<MediaPlayerHandle, {
  assetId: string;
  title: string;
  playbackObservationEnabled?: boolean;
  regionRef?: Ref<HTMLElement>;
  onPlaybackSnapshot?: (snapshot: MediaPlaybackSnapshot) => void;
}>(function UploadMediaPlayer({
  assetId,
  title,
  playbackObservationEnabled = false,
  regionRef,
  onPlaybackSnapshot,
}, ref) {
  const nativePlaybackSupported = supportsNativeMediaPlayback();
  const videoRef = useRef<HTMLVideoElement>(null);
  const metadataReadyRef = useRef(false);
  const pendingCommandRef = useRef<PendingPlayerCommand | null>(null);
  const lastSnapshotRef = useRef<MediaPlaybackSnapshot | null>(null);
  const observationEnabledRef = useRef(playbackObservationEnabled);
  const snapshotListenerRef = useRef(onPlaybackSnapshot);
  const [surfaceState, setSurfaceState] = useState<UploadMediaSurfaceState>('loading');
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  observationEnabledRef.current = playbackObservationEnabled;
  snapshotListenerRef.current = onPlaybackSnapshot;

  const noteBlockedPlayback = useCallback(
    () => setPlaybackNotice(UPLOAD_MEDIA_PLAYBACK_BLOCKED_COPY),
    [],
  );

  const emitSnapshot = useCallback(
    (state: MediaPlaybackState, positionMs: number | null) => {
      if (!observationEnabledRef.current) return;

      const previous = lastSnapshotRef.current;
      if (previous && previous.state === state && previous.positionMs === positionMs) return;

      lastSnapshotRef.current = { state, positionMs };
      snapshotListenerRef.current?.({ state, positionMs });
    },
    [],
  );

  useEffect(() => {
    metadataReadyRef.current = false;
    pendingCommandRef.current = null;
    lastSnapshotRef.current = null;
    setSurfaceState('loading');
    setPlaybackNotice(null);

    return () => {
      metadataReadyRef.current = false;
      pendingCommandRef.current = null;
      lastSnapshotRef.current = null;
    };
  }, [assetId]);

  useImperativeHandle(ref, () => ({
    seekToMs(timeMs) {
      if (!Number.isFinite(timeMs) || timeMs < 0) return;

      const element = videoRef.current;
      if (element && metadataReadyRef.current) {
        seekMediaElement(element, timeMs);
        return;
      }

      pendingCommandRef.current = { seekMs: timeMs, shouldPlay: false };
    },
    play() {
      const element = videoRef.current;
      if (element && metadataReadyRef.current) {
        startMediaPlayback(element, noteBlockedPlayback);
        return;
      }

      if (pendingCommandRef.current) {
        pendingCommandRef.current = {
          ...pendingCommandRef.current,
          shouldPlay: true,
        };
      }
    },
  }), [noteBlockedPlayback]);

  const observe = useCallback((eventType: HtmlMediaEventType, element: HTMLVideoElement) => {
    const state = mapHtmlMediaPlaybackState(eventType, element);
    emitSnapshot(state, state === 'error' ? null : readHtmlMediaPositionMs(element));
  }, [emitSnapshot]);

  const handleReadiness = useCallback((
    eventType: 'loadedmetadata' | 'canplay',
    element: HTMLVideoElement,
  ) => {
    const wasReady = metadataReadyRef.current;
    metadataReadyRef.current = true;
    setSurfaceState('ready');
    observe(eventType, element);

    if (wasReady) return;
    const pending = pendingCommandRef.current;
    pendingCommandRef.current = null;
    if (!pending) return;

    seekMediaElement(element, pending.seekMs);
    if (pending.shouldPlay) startMediaPlayback(element, noteBlockedPlayback);
  }, [noteBlockedPlayback, observe]);

  const handleMediaError = useCallback((element: HTMLVideoElement) => {
    metadataReadyRef.current = false;
    pendingCommandRef.current = null;
    setSurfaceState('error');
    setPlaybackNotice(null);
    observe('error', element);
  }, [observe]);

  if (!nativePlaybackSupported) {
    return (
      <section
        ref={regionRef}
        tabIndex={-1}
        className="upload-media-player upload-media-player--unsupported"
        aria-label={`Uploaded video player for ${title}`}
        data-player-state="unsupported-auth"
      >
        <div className="upload-media-player__header">
          <div className="upload-media-player__identity">
            <SourceBadge sourceType="UPLOAD" />
            <span className="upload-media-player__state">
              {SURFACE_STATE_LABELS.error}
            </span>
          </div>
        </div>
        <div className="upload-media-player__viewport">
          <div className="upload-media-player__message">
            <strong>{UPLOAD_MEDIA_UNSUPPORTED_AUTH_COPY.title}</strong>
            <span>{UPLOAD_MEDIA_UNSUPPORTED_AUTH_COPY.message}</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={regionRef}
      tabIndex={-1}
      className={`upload-media-player upload-media-player--${surfaceState}`}
      aria-label={`Uploaded video player for ${title}`}
      data-player-state={surfaceState}
    >
      <div className="upload-media-player__header">
        <div className="upload-media-player__identity">
          <SourceBadge sourceType="UPLOAD" />
          <span className="upload-media-player__state">
            {SURFACE_STATE_LABELS[surfaceState]}
          </span>
        </div>
      </div>

      <div className="upload-media-player__viewport">
        <video
          ref={videoRef}
          className="upload-media-player__video"
          src={buildAssetMediaUrl(assetId)}
          controls
          autoPlay={false}
          preload="metadata"
          playsInline
          aria-label={`Uploaded video: ${title}`}
          title={title}
          onLoadStart={(event) => observe('loadstart', event.currentTarget)}
          onLoadedMetadata={(event) => handleReadiness('loadedmetadata', event.currentTarget)}
          onCanPlay={(event) => handleReadiness('canplay', event.currentTarget)}
          onPlaying={(event) => {
            setPlaybackNotice(null);
            observe('playing', event.currentTarget);
          }}
          onPause={(event) => observe('pause', event.currentTarget)}
          onEnded={(event) => observe('ended', event.currentTarget)}
          onWaiting={(event) => observe('waiting', event.currentTarget)}
          onStalled={(event) => observe('stalled', event.currentTarget)}
          onSeeking={(event) => observe('seeking', event.currentTarget)}
          onSeeked={(event) => observe('seeked', event.currentTarget)}
          onTimeUpdate={(event) => observe('timeupdate', event.currentTarget)}
          onError={(event) => handleMediaError(event.currentTarget)}
        />
        {surfaceState === 'loading' ? (
          <div className="upload-media-player__message" role="status" aria-live="polite">
            {UPLOAD_MEDIA_LOADING_COPY}
          </div>
        ) : null}
        {surfaceState === 'error' ? (
          <div className="upload-media-player__message" role="alert">
            <strong>{UPLOAD_MEDIA_ERROR_COPY.title}</strong>
            <span>{UPLOAD_MEDIA_ERROR_COPY.message}</span>
          </div>
        ) : null}
      </div>

      {playbackNotice ? (
        <p className="upload-media-player__notice" role="status">{playbackNotice}</p>
      ) : null}
    </section>
  );
});
