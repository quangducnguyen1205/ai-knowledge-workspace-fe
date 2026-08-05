import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { changeLanguage, getActiveLanguage } from './i18n';
import { LanguageSelect } from './language-select';
import { LANGUAGE_STORAGE_KEY } from './storage';

beforeEach(async () => {
  window.localStorage.clear();
  await changeLanguage('en');
});

afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  await changeLanguage('en');
});

describe('LanguageSelect', () => {
  it('has an accessible name and shows the current language', () => {
    render(<LanguageSelect />);

    const control = screen.getByRole('combobox', { name: 'Display language' });
    expect(control).toHaveValue('en');
  });

  it('names each language in its own language, never with a flag', () => {
    render(<LanguageSelect />);

    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['English', 'Tiếng Việt']);
    // Each option declares its own language so assistive technology pronounces the endonym.
    expect(options.map((option) => option.getAttribute('lang'))).toEqual(['en', 'vi']);
    expect(options.map((option) => option.textContent).join('')).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('applies the choice immediately and persists it', async () => {
    render(<LanguageSelect />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'vi');

    expect(getActiveLanguage()).toBe('vi');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
    // The control's own label re-renders in the newly selected language.
    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ hiển thị' })).toHaveValue('vi');
  });

  it('is operable from the keyboard alone', async () => {
    render(<LanguageSelect />);
    const control = screen.getByRole('combobox');

    await userEvent.tab();
    expect(control).toHaveFocus();

    await userEvent.selectOptions(control, 'vi');
    expect(getActiveLanguage()).toBe('vi');
  });

  it('keeps the label available to assistive technology when it is visually hidden', () => {
    render(<LanguageSelect hideLabel />);

    const control = screen.getByRole('combobox', { name: 'Display language' });
    expect(control).toBeInTheDocument();
  });
});
