import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Kept in sync with the inline script in index.html, which applies the theme before first paint. */
export const THEME_STORAGE_KEY = 'cy-theme';

/** Canvas colours, used for the browser chrome (`theme-color`) so it matches the header surface. */
const CHROME_COLOR: Record<ResolvedTheme, string> = { light: '#FAFAFA', dark: '#0E0E10' };

const darkQuery = (): MediaQueryList | undefined =>
  typeof window === 'undefined' ? undefined : window.matchMedia('(prefers-color-scheme: dark)');

export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function writePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the choice then lasts for this visit.
  }
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

function applyTheme(theme: ResolvedTheme, preference: ThemePreference): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    // With a manual choice both scheme-specific tags must report the chosen theme.
    const scheme = meta.getAttribute('media')?.includes('dark') ? 'dark' : 'light';
    meta.content = CHROME_COLOR[preference === 'system' ? scheme : theme];
  }
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const useTheme = create<ThemeState>((set) => {
  const preference = readPreference();
  return {
    preference,
    resolved: resolveTheme(preference, darkQuery()?.matches ?? false),
    setPreference: (next) => {
      const resolved = resolveTheme(next, darkQuery()?.matches ?? false);
      writePreference(next);
      applyTheme(resolved, next);
      set({ preference: next, resolved });
    },
  };
});

/** Follows the OS setting live while the preference is System. Returns an unsubscribe function. */
export function watchSystemTheme(): () => void {
  const query = darkQuery();
  if (!query) return () => {};
  const onChange = () => {
    const { preference } = useTheme.getState();
    if (preference !== 'system') return;
    const resolved = resolveTheme('system', query.matches);
    applyTheme(resolved, 'system');
    useTheme.setState({ resolved });
  };
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}
