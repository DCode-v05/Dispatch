'use client';

import { useEffect, useState } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

export default function Providers({ children }: { children: React.ReactNode }) {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    hydrateAuth();
    hydrateTheme();
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(window.navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [hydrateAuth, hydrateTheme]);

  return (
    <ErrorBoundary>
      {!isOnline && (
        <div className="fixed inset-x-0 top-0 z-90 bg-(--danger) text-white px-4 py-2 text-center text-xs font-semibold shadow">
          You appear to be offline. Some features will be unavailable until you reconnect.
        </div>
      )}
      {children}
    </ErrorBoundary>
  );
}
