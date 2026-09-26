import { beforeEach, describe, expect, it } from 'vitest';

import { readPreference, resolveTheme, THEME_STORAGE_KEY, useTheme } from './theme';

describe('resolveTheme', () => {
  it('follows the system for the System preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('uses a manual choice regardless of the system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML =
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FAFAFA">' +
      '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0E0E10">';
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readPreference()).toBe('system');
  });

  it('persists a manual choice and applies it to the document and browser chrome', () => {
    useTheme.getState().setPreference('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    const colors = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
      (m) => m.content,
    );
    expect(colors).toEqual(['#0E0E10', '#0E0E10']);
  });

  it('clears storage and restores per-scheme chrome colours for System', () => {
    useTheme.getState().setPreference('dark');
    useTheme.getState().setPreference('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    const colors = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
      (m) => m.content,
    );
    expect(colors).toEqual(['#FAFAFA', '#0E0E10']);
  });
});
