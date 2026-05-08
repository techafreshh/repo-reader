import { useState, useEffect } from 'react';

type Theme = 'deep-dark';

const THEME_STORAGE_KEY = 'voltchat-theme';

export function useTheme() {
  // Lock theme to deep-dark (Onyx)
  const [theme] = useState<Theme>('deep-dark');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'deep-dark');
    root.classList.add('dark', 'deep-dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'deep-dark');
  }, []);

  const toggleTheme = () => {
    // No-op as we only have one theme now
    console.log('Theme is locked to Onyx.');
  };

  return { theme, toggleTheme };
}
