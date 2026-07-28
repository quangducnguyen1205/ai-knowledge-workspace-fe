import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadYouTubeIframeApi,
  resetYouTubeIframeApiLoaderForTests,
  YOUTUBE_IFRAME_API_SCRIPT_ID,
  YOUTUBE_IFRAME_API_SCRIPT_SRC,
  type YouTubeIframeApi,
} from './youtube-iframe-api';

function installLoadedApi() {
  const api = {
    Player: vi.fn(),
  } as unknown as YouTubeIframeApi;
  window.YT = api;
  return api;
}

afterEach(() => {
  resetYouTubeIframeApiLoaderForTests();
  document.getElementById(YOUTUBE_IFRAME_API_SCRIPT_ID)?.remove();
  Reflect.deleteProperty(window, 'YT');
  Reflect.deleteProperty(window, 'onYouTubeIframeAPIReady');
});

describe('YouTube IFrame API loader', () => {
  it('reuses an existing Player API without adding a script', async () => {
    const api = installLoadedApi();

    await expect(loadYouTubeIframeApi()).resolves.toBe(api);

    expect(document.getElementById(YOUTUBE_IFRAME_API_SCRIPT_ID)).toBeNull();
  });

  it('loads one HTTPS script for concurrent mounts and resolves every waiter from one callback', async () => {
    const firstLoad = loadYouTubeIframeApi();
    const secondLoad = loadYouTubeIframeApi();

    expect(firstLoad).toBe(secondLoad);
    const scripts = document.querySelectorAll(`#${YOUTUBE_IFRAME_API_SCRIPT_ID}`);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toHaveAttribute('src', YOUTUBE_IFRAME_API_SCRIPT_SRC);
    const readyCallback = window.onYouTubeIframeAPIReady;

    const api = installLoadedApi();
    readyCallback?.();

    await expect(Promise.all([firstLoad, secondLoad])).resolves.toEqual([api, api]);
    expect(window.onYouTubeIframeAPIReady).toBeUndefined();
  });

  it('reuses an existing official script even when another owner did not assign this loader id', async () => {
    const existingScript = document.createElement('script');
    existingScript.src = YOUTUBE_IFRAME_API_SCRIPT_SRC;
    document.head.appendChild(existingScript);

    const load = loadYouTubeIframeApi();

    expect(document.querySelectorAll(`script[src="${YOUTUBE_IFRAME_API_SCRIPT_SRC}"]`)).toHaveLength(1);
    const api = installLoadedApi();
    window.onYouTubeIframeAPIReady?.();
    await expect(load).resolves.toBe(api);
    existingScript.remove();
  });

  it('preserves one pre-existing callback without installing duplicate global callbacks', async () => {
    const previousCallback = vi.fn();
    window.onYouTubeIframeAPIReady = previousCallback;

    const load = loadYouTubeIframeApi();
    const installedCallback = window.onYouTubeIframeAPIReady;
    expect(installedCallback).not.toBe(previousCallback);
    expect(loadYouTubeIframeApi()).toBe(load);
    expect(window.onYouTubeIframeAPIReady).toBe(installedCallback);

    installLoadedApi();
    installedCallback?.();
    await load;

    expect(previousCallback).toHaveBeenCalledTimes(1);
    expect(window.onYouTubeIframeAPIReady).toBe(previousCallback);
  });

  it('rejects with a bounded error when the script fails to load', async () => {
    const load = loadYouTubeIframeApi();
    const script = document.getElementById(YOUTUBE_IFRAME_API_SCRIPT_ID);

    script?.dispatchEvent(new Event('error'));

    await expect(load).rejects.toThrow('YouTube IFrame API unavailable');
  });
});
