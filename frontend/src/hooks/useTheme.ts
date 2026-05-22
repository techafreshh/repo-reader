import { useState, useEffect } from 'react';

type Theme = 'light' | 'deep-dark';

const THEME_STORAGE_KEY = 'voltchat-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved as Theme) || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'deep-dark');
    if (theme === 'deep-dark') {
      root.classList.add('dark', 'deep-dark');
    } else {
      root.classList.add('light');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'deep-dark' : 'light');
  };

  return { theme, toggleTheme };
}
