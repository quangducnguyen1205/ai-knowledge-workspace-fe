import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage, getActiveLanguage, i18n, resolveInitialLanguage } from './i18n';
import { DEFAULT_LANGUAGE, isLanguage, resolveLanguage } from './locales';
import { LANGUAGE_STORAGE_KEY, readStoredLanguage, writeStoredLanguage } from './storage';

const startLanguage = getActiveLanguage();

beforeEach(() => window.localStorage.clear());

afterEach(async () => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  await changeLanguage(startLanguage);
});

describe('language resolution', () => {
  it('defaults to English and treats English as the fallback', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
    expect(resolveInitialLanguage()).toBe('en');
    expect(i18n.options.fallbackLng).toEqual(['en']);
  });

  it('normalises case and region tags onto a supported language', () => {
    expect(resolveLanguage('VI')).toBe('vi');
    expect(resolveLanguage('vi-VN')).toBe('vi');
    expect(resolveLanguage('en-GB')).toBe('en');
  });

  it('falls back to the default for an unknown, empty or corrupted preference', () => {
    expect(resolveLanguage('fr')).toBe('en');
    expect(resolveLanguage('')).toBe('en');
    expect(resolveLanguage(null)).toBe('en');
    expect(resolveLanguage('{"lang":"vi"}')).toBe('en');
  });

  it('does not consult the browser language: a first visit is deterministic', () => {
    const browserLanguage = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('vi-VN');

    expect(resolveInitialLanguage()).toBe('en');
    expect(browserLanguage).not.toHaveBeenCalled();
  });
});

describe('language persistence', () => {
  it('persists an explicit choice and restores it on the next visit', async () => {
    await changeLanguage('vi');

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
    // A reload re-runs exactly this resolution against the same store.
    expect(resolveInitialLanguage()).toBe('vi');
  });

  it('stores the canonical code even when a regional tag was requested', async () => {
    await changeLanguage('VI-vn');

    expect(getActiveLanguage()).toBe('vi');
    expect(readStoredLanguage()).toBe('vi');
  });

  it('ignores a stored value that is not a supported language', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');

    expect(readStoredLanguage()).toBeNull();
    expect(resolveInitialLanguage()).toBe('en');
  });

  it('keeps working when storage is unavailable', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(readStoredLanguage()).toBeNull();
    expect(resolveInitialLanguage()).toBe('en');
    expect(() => writeStoredLanguage('vi')).not.toThrow();
  });
});

describe('active language', () => {
  it('switches to Vietnamese and back to English', async () => {
    await changeLanguage('vi');
    expect(getActiveLanguage()).toBe('vi');
    expect(i18n.t('shell:nav.library')).toBe('Thư viện');

    await changeLanguage('en');
    expect(getActiveLanguage()).toBe('en');
    expect(i18n.t('shell:nav.library')).toBe('Library');
  });

  it('keeps the document language in step with the rendered language', async () => {
    await changeLanguage('vi');
    expect(document.documentElement.lang).toBe('vi');

    await changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('never applies an unsupported language', async () => {
    await changeLanguage('fr');

    expect(isLanguage(getActiveLanguage())).toBe(true);
    expect(getActiveLanguage()).toBe('en');
  });

  it('interpolates values into both languages', async () => {
    await changeLanguage('en');
    expect(i18n.t('search:screen.title', { workspace: 'Algorithms' })).toBe('Search within Algorithms');

    await changeLanguage('vi');
    expect(i18n.t('search:screen.title', { workspace: 'Algorithms' })).toBe('Tìm kiếm trong Algorithms');
  });

  it('pluralizes with the library rather than a hand-written count branch', async () => {
    await changeLanguage('en');
    expect(i18n.t('common:videoCount', { count: 1 })).toBe('1 video');
    expect(i18n.t('common:videoCount', { count: 4 })).toBe('4 videos');

    // Vietnamese has one grammatical number, so both counts resolve to the same form.
    await changeLanguage('vi');
    expect(i18n.t('common:videoCount', { count: 1 })).toBe('1 video');
    expect(i18n.t('common:videoCount', { count: 4 })).toBe('4 video');
  });

  it('resolves every migrated namespace key to real text in both languages', async () => {
    // A key i18next cannot resolve is returned verbatim, so a key-shaped result is a missing
    // translation. Sampled across the namespaces a signed-in user actually sees.
    const sampled = [
      'shell:nav.home',
      'shell:account.signOut',
      'common:actions.cancel',
      'errors:generic.title',
      'auth:login.submit',
      'home:hero.title',
      'library:screen.title',
      'upload:dialog.title',
      'workspaces:create.title',
      'viewer:tabs.transcript',
      'search:panel.submit',
      'moments:saved.heading',
      'settings:language.section',
      'landing:hero.title',
    ] as const;

    for (const language of ['en', 'vi'] as const) {
      await changeLanguage(language);
      for (const key of sampled) {
        const text = i18n.t(key);
        expect(text, `${language}:${key}`).not.toBe(key);
        expect(text.trim().length, `${language}:${key}`).toBeGreaterThan(0);
      }
    }
  });
});
