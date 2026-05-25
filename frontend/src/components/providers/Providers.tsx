'use client';

import { useEffect, useSyncExternalStore } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

function subscribeOnline(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
function getOnlineSnapshot(): boolean {
  return typeof window === 'undefined' ? true : window.navigator.onLine;
}
function getOnlineServerSnapshot(): boolean {
  return true;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot,
  );

  useEffect(() => {
    hydrateAuth();
    hydrateTheme();
  }, [hydrateAuth, hydrateTheme]);

  return (
    <ErrorBoundary>
      {!isOnline && (
        <div className="fixed inset-x-0 top-0 z-90 bg-(--danger) text-white px-4 py-2 text-center text-xs font-semibold shadow">
          You appear to be offline. Some features will be unavailable until you
          reconnect.
        </div>
      )}
      {children}
    </ErrorBoundary>
  );
}
