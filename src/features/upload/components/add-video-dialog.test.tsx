import type { ComponentProps } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../../../shared/api/api-error';
import { AssetUploadDialog } from './asset-upload-dialog';

function renderDialog(overrides: Partial<ComponentProps<typeof AssetUploadDialog>> = {}) {
  const props: ComponentProps<typeof AssetUploadDialog> = {
    workspaceName: 'Distributed Systems',
    uploadError: null,
    isUploading: false,
    youtubeError: null,
    isCreatingYouTube: false,
    onUpload: vi.fn(),
    onCreateYouTube: vi.fn(),
    onResetCreation: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  const view = render(<AssetUploadDialog {...props} />);
  return { ...view, props };
}

afterEach(() => cleanup());

describe('Add video source entry', () => {
  it('defaults to Upload file and switches focus to the explicit YouTube form', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByRole('radio', { name: 'Upload file' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Video title (optional)' })).toBeInTheDocument();
    expect(screen.getByLabelText(/video file/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'YouTube URL' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'YouTube URL' }));

    const urlInput = screen.getByRole('textbox', { name: 'YouTube URL' });
    await waitFor(() => expect(urlInput).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Add YouTube video' })).toBeEnabled();
  });

  it('does not submit stale inputs from the inactive source form', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();
    const staleFile = new File(['video'], 'stale.mp4', { type: 'video/mp4' });

    await user.upload(screen.getByLabelText(/video file/i), staleFile);
    await user.type(screen.getByRole('textbox', { name: 'Video title (optional)' }), 'Stale upload title');
    await user.click(screen.getByRole('radio', { name: 'YouTube URL' }));
    await user.type(screen.getByRole('textbox', { name: 'YouTube URL' }), 'https://youtu.be/abc_DEF-123');
    await user.type(screen.getByRole('textbox', { name: 'Video title (optional)' }), ' YouTube title ');
    await user.click(screen.getByRole('button', { name: 'Add YouTube video' }));

    expect(props.onCreateYouTube).toHaveBeenCalledWith({
      url: 'https://youtu.be/abc_DEF-123',
      title: 'YouTube title',
    });
    expect(props.onUpload).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: 'Upload file' }));
    expect(screen.getByLabelText(/video file/i)).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Video title (optional)' })).toHaveValue('');
  });

  it('requires a URL and rejects only obviously non-HTTPS input before Spring validation', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();
    await user.click(screen.getByRole('radio', { name: 'YouTube URL' }));

    await user.click(screen.getByRole('button', { name: 'Add YouTube video' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a YouTube video URL.');

    await user.type(screen.getByRole('textbox', { name: 'YouTube URL' }), 'http://youtu.be/abc_DEF-123');
    await user.click(screen.getByRole('button', { name: 'Add YouTube video' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use an HTTPS YouTube video URL.');
    expect(props.onCreateYouTube).not.toHaveBeenCalled();

    await user.clear(screen.getByRole('textbox', { name: 'YouTube URL' }));
    await user.type(screen.getByRole('textbox', { name: 'YouTube URL' }), 'https://youtu.be/abc_DEF-123');
    await user.click(screen.getByRole('button', { name: 'Add YouTube video' }));
    expect(props.onCreateYouTube).toHaveBeenCalledWith({
      url: 'https://youtu.be/abc_DEF-123',
      title: undefined,
    });
  });

  it('disables source switching and duplicate submit controls while YouTube creation is pending', async () => {
    const user = userEvent.setup();
    const view = renderDialog();
    await user.click(screen.getByRole('radio', { name: 'YouTube URL' }));

    view.rerender(<AssetUploadDialog {...view.props} isCreatingYouTube />);

    expect(screen.getByRole('button', { name: 'Adding YouTube video...' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Upload file' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'YouTube URL' })).toBeDisabled();
    expect(screen.getByText('Adding YouTube video')).toBeInTheDocument();
  });

  it('renders stable YouTube creation errors without raw backend diagnostics', async () => {
    const user = userEvent.setup();
    renderDialog({
      youtubeError: new ApiClientError(
        400,
        'provider stderr with https://private.example/video and stack trace',
        'INVALID_YOUTUBE_URL',
      ),
    });
    await user.click(screen.getByRole('radio', { name: 'YouTube URL' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a supported public YouTube video URL.');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/provider|private\.example|stack trace/i);
  });
});
