import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../app/AppShell';
import { changeLanguage, LANGUAGE_STORAGE_KEY, resolveInitialLanguage } from '../../shared/i18n';
import { SettingsScreen } from './settings';

/**
 * The language control in its real place, and the effect of using it on a real product surface.
 *
 * The point of these assertions is not the individual words — the parity test already proves both
 * languages are complete. It is that choosing a language changes what a signed-in user actually
 * reads, survives a reload, and leaves the document's declared language correct.
 */

const workspace = {
  id: 'workspace-1',
  name: 'Distributed Systems',
  createdAt: '2026-06-26T00:00:00Z',
};

function renderSettings() {
  return render(
    <SettingsScreen
      currentUserEmail="learner@example.com"
      workspaceManagement={<p>workspace management</p>}
      logoutError={null}
      isLoggingOut={false}
      onLogout={vi.fn()}
    />,
  );
}

function renderShell() {
  return render(
    <AppShell
      route={{ name: 'library' }}
      navigate={vi.fn()}
      workspaces={[workspace]}
      selectedWorkspace={workspace}
      selectedWorkspaceId={workspace.id}
      currentUserEmail="learner@example.com"
      isWorkspaceFetching={false}
      isLogoutPending={false}
      onSelectWorkspace={vi.fn()}
      onLogout={vi.fn()}
    >
      <p>library content</p>
    </AppShell>,
  );
}

beforeEach(async () => {
  window.localStorage.clear();
  await changeLanguage('en');
});

afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  await changeLanguage('en');
});

describe('Settings language control', () => {
  it('sits in Settings with a labelled control and the English default selected', () => {
    renderSettings();

    expect(screen.getByRole('heading', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Display language' })).toHaveValue('en');
  });

  it('switches the whole Settings surface to Vietnamese and back', async () => {
    renderSettings();
    const control = screen.getByRole('combobox', { name: 'Display language' });

    expect(screen.getByRole('heading', { name: 'Workspace and account' })).toBeInTheDocument();

    await userEvent.selectOptions(control, 'vi');
    expect(screen.getByRole('heading', { name: 'Không gian làm việc và tài khoản' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Workspace and account' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ngôn ngữ hiển thị' }), 'en');
    expect(screen.getByRole('heading', { name: 'Workspace and account' })).toBeInTheDocument();
  });

  it('applies the choice to the authenticated shell, not only to Settings', async () => {
    const settings = renderSettings();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Display language' }), 'vi');
    settings.unmount();

    renderShell();
    expect(screen.getByRole('link', { name: 'Thư viện' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Mở menu tài khoản' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Library' })).not.toBeInTheDocument();
  });

  it('survives a remount and would survive a reload', async () => {
    const first = renderSettings();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Display language' }), 'vi');
    first.unmount();

    // Remount: the running instance keeps the language.
    renderSettings();
    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ hiển thị' })).toHaveValue('vi');

    // Reload: boot resolution reads the same persisted value the control wrote.
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
    expect(resolveInitialLanguage()).toBe('vi');
  });

  it('keeps the document language in step with the chosen language', async () => {
    renderSettings();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Display language' }), 'vi');
    expect(document.documentElement.lang).toBe('vi');

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ngôn ngữ hiển thị' }), 'en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('leaves no untranslated English in the migrated Settings surface', async () => {
    renderSettings();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Display language' }), 'vi');

    const surface = screen.getByRole('heading', { name: 'Không gian làm việc và tài khoản' })
      .closest('.settings-screen');
    const text = surface?.textContent ?? '';

    // The email is account data and the endonyms name themselves; nothing else stays English.
    expect(text).not.toMatch(/Workspace and account|Diagnostics|App revision|Sign out/);
  });
});
