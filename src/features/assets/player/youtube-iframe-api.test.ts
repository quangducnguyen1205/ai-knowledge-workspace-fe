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
  for (const script of Array.from(document.scripts)) {
    if (script.src === YOUTUBE_IFRAME_API_SCRIPT_SRC) script.remove();
  }
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

  it('removes an owned failed script, clears the rejected promise, and shares one later retry', async () => {
    const preexistingCallback = vi.fn();
    window.onYouTubeIframeAPIReady = preexistingCallback;
    const firstLoad = loadYouTubeIframeApi();
    const firstScript = document.getElementById(YOUTUBE_IFRAME_API_SCRIPT_ID) as HTMLScriptElement;
    const failedAttemptCallback = window.onYouTubeIframeAPIReady;

    firstScript.dispatchEvent(new Event('error'));
    await expect(firstLoad).rejects.toThrow('YouTube IFrame API unavailable');

    expect(firstScript.isConnected).toBe(false);
    expect(window.onYouTubeIframeAPIReady).toBe(preexistingCallback);

    const retryOne = loadYouTubeIframeApi();
    const retryTwo = loadYouTubeIframeApi();
    expect(retryOne).toBe(retryTwo);
    expect(retryOne).not.toBe(firstLoad);
    expect(document.querySelectorAll(`script[src="${YOUTUBE_IFRAME_API_SCRIPT_SRC}"]`)).toHaveLength(1);
    expect(window.onYouTubeIframeAPIReady).not.toBe(failedAttemptCallback);

    const api = installLoadedApi();
    window.onYouTubeIframeAPIReady?.();
    await expect(Promise.all([retryOne, retryTwo])).resolves.toEqual([api, api]);
    expect(preexistingCallback).toHaveBeenCalledTimes(1);
    expect(window.onYouTubeIframeAPIReady).toBe(preexistingCallback);
  });

  it('preserves a failed externally owned script while allowing an owned retry', async () => {
    const externalScript = document.createElement('script');
    externalScript.src = YOUTUBE_IFRAME_API_SCRIPT_SRC;
    externalScript.dataset.owner = 'external';
    document.head.appendChild(externalScript);

    const firstLoad = loadYouTubeIframeApi();
    externalScript.dispatchEvent(new Event('error'));
    await expect(firstLoad).rejects.toThrow('YouTube IFrame API unavailable');
    expect(externalScript.isConnected).toBe(true);

    const retry = loadYouTubeIframeApi();
    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>(
      `script[src="${YOUTUBE_IFRAME_API_SCRIPT_SRC}"]`,
    ));
    expect(scripts).toHaveLength(2);
    expect(scripts).toContain(externalScript);

    const api = installLoadedApi();
    window.onYouTubeIframeAPIReady?.();
    await expect(retry).resolves.toBe(api);
  });
});
