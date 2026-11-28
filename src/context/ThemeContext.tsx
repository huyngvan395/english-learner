import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type AppTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'tmh_theme_v1';

interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  isLight: boolean;
  setTheme: (next: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignore storage errors
  }
  return 'dark';
}

function applyThemeToDocument(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => readInitialTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        isLight: theme === 'light',
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
};
