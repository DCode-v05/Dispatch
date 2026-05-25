'use client';

import { useThemeStore } from '@/stores/themeStore';

interface ThemeToggleProps {
  variant?: 'icon' | 'segmented';
  className?: string;
}

export default function ThemeToggle({
  variant = 'icon',
  className = '',
}: ThemeToggleProps) {
  const { mode, resolved, setMode } = useThemeStore();

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex p-1 rounded-xl bg-(--line-soft) gap-1 ${className}`}
        role="radiogroup"
        aria-label="Theme"
      >
        {(['light', 'dark', 'system'] as const).map((option) => {
          const active = mode === option;
          return (
            <button
              key={option}
              onClick={() => setMode(option)}
              role="radio"
              aria-checked={active}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${
                active
                  ? 'bg-(--surface) text-(--ink) shadow-soft'
                  : 'text-(--ink-muted) hover:text-(--ink)'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <button
      onClick={() => setMode(next)}
      className={`relative h-9 w-9 rounded-xl flex items-center justify-center transition group text-(--ink-muted) hover:text-(--ink) hover:bg-(--line-soft) ${className}`}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`absolute h-5 w-5 transition-all duration-300 ${
          resolved === 'light'
            ? 'opacity-100 rotate-0 scale-100'
            : 'opacity-0 -rotate-90 scale-50'
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className={`absolute h-5 w-5 transition-all duration-300 ${
          resolved === 'dark'
            ? 'opacity-100 rotate-0 scale-100'
            : 'opacity-0 rotate-90 scale-50'
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}
