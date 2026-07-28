export const YOUTUBE_IFRAME_API_SCRIPT_ID = 'youtube-iframe-api';
export const YOUTUBE_IFRAME_API_SCRIPT_SRC = 'https://www.youtube.com/iframe_api';

export type YouTubePlayerInstance = {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
};

export type YouTubePlayerEvent = {
  target: YouTubePlayerInstance;
};

export type YouTubePlayerStateEvent = YouTubePlayerEvent & {
  data: number;
};

export type YouTubePlayerOptions = {
  videoId: string;
  width: string;
  height: string;
  host: string;
  playerVars: {
    autoplay: 0;
    controls: 1;
    fs: 1;
    playsinline: 1;
    rel: 0;
    origin?: string;
  };
  events: {
    onReady(event: YouTubePlayerEvent): void;
    onStateChange(event: YouTubePlayerStateEvent): void;
    onError(): void;
  };
};

export type YouTubeIframeApi = {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<YouTubeIframeApi> | null = null;
let installedReadyCallback: (() => void) | null = null;
let previousReadyCallback: (() => void) | undefined;
let failedExternalScripts = new WeakSet<HTMLScriptElement>();

function getLoadedApi(): YouTubeIframeApi | null {
  return typeof window.YT?.Player === 'function' ? window.YT : null;
}

function restoreReadyCallback() {
  if (window.onYouTubeIframeAPIReady !== installedReadyCallback) return;

  if (previousReadyCallback) {
    window.onYouTubeIframeAPIReady = previousReadyCallback;
  } else {
    Reflect.deleteProperty(window, 'onYouTubeIframeAPIReady');
  }
  installedReadyCallback = null;
  previousReadyCallback = undefined;
}

export function loadYouTubeIframeApi(): Promise<YouTubeIframeApi> {
  const loadedApi = getLoadedApi();
  if (loadedApi) return Promise.resolve(loadedApi);
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise<YouTubeIframeApi>((resolve, reject) => {
    const scriptWithLoaderId = document.getElementById(YOUTUBE_IFRAME_API_SCRIPT_ID);
    const existingScript = (
      scriptWithLoaderId instanceof HTMLScriptElement &&
      !failedExternalScripts.has(scriptWithLoaderId)
        ? scriptWithLoaderId
        : null
    ) ?? Array.from(document.scripts).find(
      (candidate) =>
        candidate.src === YOUTUBE_IFRAME_API_SCRIPT_SRC &&
        !failedExternalScripts.has(candidate),
    );
    const script = existingScript instanceof HTMLScriptElement
      ? existingScript
      : document.createElement('script');
    const scriptOwnedByLoader = !existingScript;
    let settled = false;

    function finishWithApi() {
      if (settled) return;
      const api = getLoadedApi();
      if (!api) {
        finishWithError();
        return;
      }

      settled = true;
      script.removeEventListener('error', finishWithError);
      restoreReadyCallback();
      resolve(api);
    }

    function finishWithError() {
      if (settled) return;
      settled = true;
      script.removeEventListener('error', finishWithError);
      if (scriptOwnedByLoader) script.remove();
      else failedExternalScripts.add(script);
      restoreReadyCallback();
      apiLoadPromise = null;
      reject(new Error('YouTube IFrame API unavailable'));
    }

    previousReadyCallback = window.onYouTubeIframeAPIReady;
    installedReadyCallback = () => {
      try {
        previousReadyCallback?.();
      } catch {
        // Another consumer callback must not prevent this loader from settling.
      }
      finishWithApi();
    };
    window.onYouTubeIframeAPIReady = installedReadyCallback;
    script.addEventListener('error', finishWithError, { once: true });

    if (scriptOwnedByLoader) {
      script.id = document.getElementById(YOUTUBE_IFRAME_API_SCRIPT_ID)
        ? `${YOUTUBE_IFRAME_API_SCRIPT_ID}-retry`
        : YOUTUBE_IFRAME_API_SCRIPT_ID;
      script.src = YOUTUBE_IFRAME_API_SCRIPT_SRC;
      script.async = true;
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      document.head.appendChild(script);
    }
  });

  return apiLoadPromise;
}

export function resetYouTubeIframeApiLoaderForTests() {
  restoreReadyCallback();
  apiLoadPromise = null;
  installedReadyCallback = null;
  previousReadyCallback = undefined;
  failedExternalScripts = new WeakSet<HTMLScriptElement>();
}
