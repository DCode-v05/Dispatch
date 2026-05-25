'use client';

import { useToastStore } from '@/stores/toastStore';

const KIND_STYLES: Record<
  string,
  { iconColor: string; iconBg: string; ringColor: string }
> = {
  success: {
    iconColor: 'text-(--positive)',
    iconBg: 'bg-(--positive-soft)',
    ringColor: 'ring-(--positive)/30',
  },
  error: {
    iconColor: 'text-(--danger)',
    iconBg: 'bg-(--danger-soft)',
    ringColor: 'ring-(--danger)/30',
  },
  info: {
    iconColor: 'text-(--accent)',
    iconBg: 'bg-(--accent-soft)',
    ringColor: 'ring-(--accent)/30',
  },
};

const ICONS: Record<string, React.ReactNode> = {
  success: (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  ),
  info: (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed top-4 right-4 z-100 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const style = KIND_STYLES[t.kind] ?? KIND_STYLES.info;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto animate-slide-in-right bg-(--surface) rounded-xl shadow-pop ring-1 ${style.ringColor} border border-(--line) px-4 py-3 flex items-start gap-3 min-w-[280px]`}
          >
            <div
              className={`shrink-0 w-7 h-7 rounded-lg ${style.iconBg} ${style.iconColor} flex items-center justify-center`}
            >
              {ICONS[t.kind]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-(--ink) leading-tight">
                {t.title}
              </p>
              {t.description && (
                <p className="text-xs text-(--ink-muted) mt-0.5 leading-snug">
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-(--ink-subtle) hover:text-(--ink) transition-colors -mr-1 -mt-1 p-1 rounded-md"
              aria-label="Dismiss"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
