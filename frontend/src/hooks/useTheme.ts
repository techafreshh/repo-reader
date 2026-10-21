import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'deep-dark';

const THEME_STORAGE_KEY = 'voltchat-theme';
const VT_STYLE_ID = 'voltchat-theme-vt';

// Theme repaint via the View Transition API: the new theme wipes upward with
// one ease-out reveal. Gracefully falls back to an instant swap when the API
// is unavailable or the user prefers reduced motion.
const VT_CSS = `
html[data-theme-vt="rect"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-theme-vt="rect"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: theme-rect-reveal 380ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes theme-rect-reveal {
  from { clip-path: inset(100% 0 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}
`;

function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark', 'deep-dark');
  if (theme === 'deep-dark') {
    root.classList.add('dark', 'deep-dark');
  } else {
    root.classList.add('light');
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved as Theme) || 'light';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setNextTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'deep-dark' : 'light'));
  }, []);

  const toggleTheme = useCallback(() => {
    const doc = document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> };
    };
    if (prefersReducedMotion() || typeof doc.startViewTransition !== 'function') {
      setNextTheme();
      return;
    }

    if (!document.getElementById(VT_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = VT_STYLE_ID;
      style.textContent = VT_CSS;
      document.head.appendChild(style);
    }

    const root = document.documentElement;
    root.dataset.themeVt = 'rect';
    doc
      .startViewTransition(() => setNextTheme())
      .finished.finally(() => {
        delete root.dataset.themeVt;
      });
  }, [setNextTheme]);

  return { theme, toggleTheme };
}
