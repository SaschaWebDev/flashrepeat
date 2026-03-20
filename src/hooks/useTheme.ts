import { useEffect, useState } from 'react';
import type { ThemeMode } from '../types';
import { getSettings, updateSettings } from '../db/operations';

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(mode: ThemeMode): void {
  const resolved = mode === 'system' ? getSystemTheme() : mode;
  document.documentElement.classList.toggle('light', resolved === 'light');
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    // Read from localStorage for instant load before DB init
    return (localStorage.getItem('fr-theme') as ThemeMode) ?? 'dark';
  });

  useEffect(() => {
    getSettings().then(s => {
      const t = s.theme ?? 'dark';
      setThemeState(t);
      applyTheme(t);
      localStorage.setItem('fr-theme', t);
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  function setTheme(mode: ThemeMode) {
    setThemeState(mode);
    applyTheme(mode);
    localStorage.setItem('fr-theme', mode);
    updateSettings({ theme: mode });
  }

  return { theme, setTheme };
}

// Apply theme on page load from localStorage (before React mounts)
const stored = localStorage.getItem('fr-theme') as ThemeMode | null;
if (stored) {
  applyTheme(stored);
}
