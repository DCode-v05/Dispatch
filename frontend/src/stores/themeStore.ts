'use client';

import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'system';

interface ThemeState {
  mode: ThemeMode;
  resolved: Theme;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => void;
}

const STORAGE_KEY = 'dispatch-theme';

function resolveTheme(mode: ThemeMode): Theme {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  resolved: 'light',

  setMode: (mode) => {
    const resolved = resolveTheme(mode);
    applyTheme(resolved);
    try {
      if (mode === 'system') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, mode);
      }
    } catch {
      /* localStorage unavailable */
    }
    set({ mode, resolved });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    let saved: ThemeMode = 'system';
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'light' || raw === 'dark') saved = raw;
    } catch {
      /* localStorage unavailable */
    }

    const resolved = resolveTheme(saved);
    applyTheme(resolved);
    set({ mode: saved, resolved });

    // Subscribe to system theme changes while mode === 'system'
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (get().mode === 'system') {
        const newTheme: Theme = mql.matches ? 'dark' : 'light';
        applyTheme(newTheme);
        set({ resolved: newTheme });
      }
    };
    mql.addEventListener?.('change', handler);
  },
}));
