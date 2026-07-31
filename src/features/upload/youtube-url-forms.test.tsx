import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../../shared/api/api-error';
import { resetApiAuthForTests } from '../../shared/api/http-client';
import { createYouTubeAsset } from './api/upload-api';
import { YouTubeAssetForm } from './components/youtube-asset-form';

const VIDEO_ID = 'abc_DEF-123';

function renderForm(overrides: Partial<Parameters<typeof YouTubeAssetForm>[0]> = {}) {
  const onCreate = vi.fn();
  render(
    <YouTubeAssetForm
      workspaceName="Distributed Systems"
      creationError={null}
      isCreating={false}
      onCreate={onCreate}
      {...overrides}
    />,
  );
  return { onCreate };
}

afterEach(() => {
  cleanup();
  resetApiAuthForTests();
  vi.unstubAllGlobals();
});

/**
 * The client stays deliberately no stricter than Spring: it checks only for a non-blank HTTPS
 * URL, and Spring's YouTubeUrlPolicy owns hostname, video-id and canonicalization truth. Every
 * form Spring accepts must therefore pass the client too.
 */
describe('YouTube URL forms accepted by the client', () => {
  const acceptedForms = [
    ['watch URL without www', `https://youtube.com/watch?v=${VIDEO_ID}`],
    ['watch URL with www', `https://www.youtube.com/watch?v=${VIDEO_ID}`],
    ['mobile host', `https://m.youtube.com/watch?v=${VIDEO_ID}`],
    ['short URL', `https://youtu.be/${VIDEO_ID}`],
  ] as const;

  for (const [label, url] of acceptedForms) {
    it(`submits the ${label} unchanged`, async () => {
      const user = userEvent.setup();
      const { onCreate } = renderForm();

      await user.type(screen.getByLabelText('YouTube URL'), url);
      await user.click(screen.getByRole('button', { name: 'Add YouTube video' }));

      expect(onCreate).toHaveBeenCalledWith({ url, title: undefined });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  }

  it('sends the exact Spring request payload for a no-www watch URL', async () => {
    const url = `https://youtube.com/watch?v=${VIDEO_ID}`;
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({
        assetId: 'a-1', processingJobId: 'j-1', assetStatus: 'PROCESSING',
        workspaceId: 'ws-1', sourceType: 'YOUTUBE', youtubeVideoId: VIDEO_ID,
        sourceUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      }), { status: 202, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await createYouTubeAsset({ url, title: '  Fixture  ' });

    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('/api/assets/youtube');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ url, title: 'Fixture' });
    // Spring owns canonicalization; the client renders what Spring derived.
    expect(response.sourceUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    expect(response.youtubeVideoId).toBe(VIDEO_ID);
  });
});

describe('bounded feedback for URLs Spring rejects', () => {
  it('keeps client-side rejection to non-HTTPS input only', async () => {
    const user = userEvent.setup();
    const { onCreate } = renderForm();

    await user.type(screen.getByLabelText('YouTube URL'), `http://youtube.com/watch?v=${VIDEO_ID}`);
    await user.click(screen.getByRole('button', { name: 'Add YouTube video' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Use an HTTPS YouTube video URL.');
  });

  it('shows bounded copy for a deceptive host the backend rejected, without echoing the URL', () => {
    renderForm({
      creationError: new ApiClientError(400, 'The request could not be completed.', 'INVALID_YOUTUBE_URL'),
    });

    const alert = screen.getAllByRole('alert').map((el) => el.textContent).join(' ');
    expect(alert).toMatch(/YouTube/);
    expect(alert).not.toContain('youtube.com.evil.example');
    expect(alert).not.toMatch(/exception|sql|stack/i);
  });
});
